import { describe, it, expect, beforeEach, vi } from 'vitest'

const queryOne = vi.fn()

vi.mock('@/server/db/pool', () => ({ queryOne }))

const { getEntityGuard } = await import('../entityGuards')
const { UserRole, CountSessionStatus, IncidentStatus } = await import('@/types')

const TELLER_A = { id: 'teller-a', roles: [UserRole.TELLER] }
const TELLER_B = { id: 'teller-b', roles: [UserRole.TELLER] }
const VULLER_A = { id: 'vuller-a', roles: [UserRole.VULLER] }
const VULLER_B = { id: 'vuller-b', roles: [UserRole.VULLER] }
const PLANNER = { id: 'planner-1', roles: [UserRole.PLANNER] }

/** Roept de guard aan zoals /api/rpc dat doet. */
async function run(
  resource: string,
  method: string,
  user: { id: string; roles: (typeof UserRole)[keyof typeof UserRole][] },
  args: unknown[]
) {
  const guard = getEntityGuard(resource, method)
  expect(guard, `geen guard voor ${resource}.${method}`).not.toBeNull()
  await guard!(user, args)
}

beforeEach(() => {
  queryOne.mockReset()
})

describe('telrondes', () => {
  function session(userId: string, status = CountSessionStatus.IN_PROGRESS) {
    return { user_id: userId, status }
  }

  it('laat een teller de telronde van een ander niet aanpassen', async () => {
    queryOne.mockResolvedValue(session(TELLER_B.id))

    await expect(run('count', 'updateSession', TELLER_A, ['sessie-1', {}])).rejects.toThrow(
      /telronde van iemand anders/
    )
  })

  it('laat een teller zijn eigen telronde wel aanpassen', async () => {
    queryOne.mockResolvedValue(session(TELLER_A.id))

    await expect(run('count', 'updateSession', TELLER_A, ['sessie-1', {}])).resolves.toBeUndefined()
  })

  it('laat een teller een goedgekeurde telronde niet meer wijzigen', async () => {
    queryOne.mockResolvedValue(session(TELLER_A.id, CountSessionStatus.APPROVED))

    await expect(run('count', 'updateSession', TELLER_A, ['sessie-1', {}])).rejects.toThrow(
      /al goedgekeurd/
    )
  })

  it('laat een planner wel bij de telronde van een ander', async () => {
    await expect(run('count', 'updateSession', PLANNER, ['sessie-1', {}])).resolves.toBeUndefined()
    // De planner hoeft er niet eens voor opgezocht te worden.
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('beschermt ook de kiosktelling in andermans ronde', async () => {
    queryOne
      .mockResolvedValueOnce({ count_session_id: 'sessie-1' })
      .mockResolvedValueOnce(session(TELLER_B.id))

    await expect(
      run('count', 'upsertKioskCount', TELLER_A, [{ countSessionId: 'sessie-1' }])
    ).rejects.toThrow(/iemand anders/)
  })

  it('beschermt ook de telregels in andermans ronde', async () => {
    queryOne
      .mockResolvedValueOnce({ count_session_id: 'sessie-1' })
      .mockResolvedValueOnce(session(TELLER_B.id))

    await expect(
      run('count', 'upsertCountEntry', TELLER_A, [{ kioskCountId: 'kc-1' }])
    ).rejects.toThrow(/iemand anders/)
  })

  it('laat een teller geen telronde op andermans naam starten', async () => {
    await expect(
      run('count', 'createSession', TELLER_A, [{ userId: TELLER_B.id }])
    ).rejects.toThrow(/eigen naam/)
  })

  it('laat een planner een telronde voor een teller aanmaken', async () => {
    await expect(
      run('count', 'createSession', PLANNER, [{ userId: TELLER_A.id }])
    ).resolves.toBeUndefined()
  })
})

describe('vulrondes', () => {
  it('laat een vuller de ronde van een ander niet aanpassen', async () => {
    queryOne.mockResolvedValue({ assigned_user_id: VULLER_B.id })

    await expect(run('restock', 'updateRound', VULLER_A, ['ronde-1', {}])).rejects.toThrow(
      /van iemand anders/
    )
  })

  it('laat een vuller zijn eigen ronde aanpassen', async () => {
    queryOne.mockResolvedValue({ assigned_user_id: VULLER_A.id })

    await expect(run('restock', 'updateRound', VULLER_A, ['ronde-1', {}])).resolves.toBeUndefined()
  })

  it('laat een vuller een vrije ronde aannemen', async () => {
    // Aannemen ís het zetten van assignedUserId; zolang er niemand op staat mag
    // iedereen met vulrechten hem oppakken.
    queryOne.mockResolvedValue({ assigned_user_id: null })

    await expect(
      run('restock', 'updateRound', VULLER_A, ['ronde-1', { assignedUserId: VULLER_A.id }])
    ).resolves.toBeUndefined()
  })

  it('laat een planner bij elke ronde', async () => {
    await expect(run('restock', 'updateRound', PLANNER, ['ronde-1', {}])).resolves.toBeUndefined()
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('beschermt de haltes van andermans ronde', async () => {
    queryOne
      .mockResolvedValueOnce({ restock_round_id: 'ronde-1' })
      .mockResolvedValueOnce({ assigned_user_id: VULLER_B.id })

    await expect(run('restock', 'updateStop', VULLER_A, ['halte-1', {}])).rejects.toThrow(
      /van iemand anders/
    )
  })

  it('beschermt de levering op andermans ronde', async () => {
    queryOne.mockResolvedValue({ assigned_user_id: VULLER_B.id })

    await expect(
      run('restock', 'registerDeliveryAtomic', VULLER_A, [{ roundId: 'ronde-1' }])
    ).rejects.toThrow(/van iemand anders/)
  })

  it('laat een vuller geen ronde op andermans naam maken', async () => {
    await expect(
      run('restock', 'createRound', VULLER_A, [{ createdById: VULLER_B.id }])
    ).rejects.toThrow(/eigen naam/)

    await expect(
      run('restock', 'reserveRoundAtomic', VULLER_A, [
        { round: { createdById: VULLER_B.id }, kioskIds: [], productIds: [] },
      ])
    ).rejects.toThrow(/eigen naam/)
  })
})

describe('storingen', () => {
  it('laat de melder zijn eigen openstaande melding bijstellen', async () => {
    queryOne.mockResolvedValue({ reported_by_id: VULLER_A.id, status: IncidentStatus.OPEN })

    await expect(
      run('incident', 'updateIncident', VULLER_A, ['storing-1', { description: 'Beter beschreven' }])
    ).resolves.toBeUndefined()
  })

  it('laat de melder de status niet zelf zetten', async () => {
    queryOne.mockResolvedValue({ reported_by_id: VULLER_A.id, status: IncidentStatus.OPEN })

    await expect(
      run('incident', 'updateIncident', VULLER_A, [
        'storing-1',
        { status: IncidentStatus.RESOLVED },
      ])
    ).rejects.toThrow(/alleen de omschrijving/)
  })

  it('laat de melder er niet meer bij zodra de storing is opgepakt', async () => {
    queryOne.mockResolvedValue({
      reported_by_id: VULLER_A.id,
      status: IncidentStatus.IN_PROGRESS,
    })

    await expect(
      run('incident', 'updateIncident', VULLER_A, ['storing-1', { description: 'Toch anders' }])
    ).rejects.toThrow(/al opgepakt/)
  })

  it('laat niemand andermans melding aanpassen', async () => {
    queryOne.mockResolvedValue({ reported_by_id: VULLER_B.id, status: IncidentStatus.OPEN })

    await expect(
      run('incident', 'updateIncident', VULLER_A, ['storing-1', { description: 'Hoi' }])
    ).rejects.toThrow(/iemand anders gemeld/)
  })

  it('laat een planner status en toewijzing beheren', async () => {
    await expect(
      run('incident', 'updateIncident', PLANNER, [
        'storing-1',
        { status: IncidentStatus.IN_PROGRESS, assignedToId: 'monteur-1' },
      ])
    ).resolves.toBeUndefined()
  })
})
