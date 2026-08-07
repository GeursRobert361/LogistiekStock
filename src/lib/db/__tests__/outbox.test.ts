import { describe, it, expect, beforeEach } from 'vitest'
import {
  addToOutbox,
  getPendingOutboxEntries,
  markOutboxEntrySuccess,
  markOutboxEntryFailed,
  getOfflineDb,
} from '../offlineDb'

/**
 * De outbox houdt één openstaande mutatie per entiteit bij. Dat betekent dat
 * een nieuwe wijziging de plek van de vorige inneemt — ook wanneer die vorige
 * op dat moment al onderweg is naar de server.
 *
 * Precies daar ging het mis: de geslaagde verzending ruimde "zijn" regel op
 * id op en gooide daarmee de nieuwere wijziging weg. De outbox was leeg, de
 * app meldde "alles opgeslagen", en de server hield de oude waarde. Zo verdween
 * bij het tellen een overgeslagen kiosk: eerst "bezig", daarna "overgeslagen",
 * en op de server bleef "bezig" staan.
 */
describe('outbox', () => {
  beforeEach(async () => {
    await getOfflineDb().outbox.clear()
  })

  async function entry(id: string) {
    return (await getPendingOutboxEntries()).find((e) => e.id === id)
  }

  it('vervangt een openstaande mutatie in plaats van er een tweede te maken', async () => {
    await addToOutbox({
      id: 'kioskCount:1',
      entityType: 'kioskCount',
      entityId: '1',
      operation: 'create',
      payload: { status: 'IN_PROGRESS' },
    })
    await addToOutbox({
      id: 'kioskCount:1',
      entityType: 'kioskCount',
      entityId: '1',
      operation: 'update',
      payload: { status: 'SKIPPED' },
    })

    const pending = await getPendingOutboxEntries()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.payload).toEqual({ status: 'SKIPPED' })
    expect(pending[0]!.revision).toBe(2)
  })

  it('houdt een nieuwere mutatie vast als de vorige net geslaagd is', async () => {
    await addToOutbox({
      id: 'kioskCount:1',
      entityType: 'kioskCount',
      entityId: '1',
      operation: 'create',
      payload: { status: 'IN_PROGRESS' },
    })
    const inFlight = (await entry('kioskCount:1'))!

    // De gebruiker slaat de kiosk over terwijl het aanmaken onderweg is.
    await addToOutbox({
      id: 'kioskCount:1',
      entityType: 'kioskCount',
      entityId: '1',
      operation: 'update',
      payload: { status: 'SKIPPED' },
    })

    await markOutboxEntrySuccess(inFlight.id, inFlight.revision ?? 0)

    const remaining = await entry('kioskCount:1')
    expect(remaining?.payload).toEqual({ status: 'SKIPPED' })
  })

  it('ruimt wel op wanneer er niets is bijgekomen', async () => {
    await addToOutbox({
      id: 'countEntry:1',
      entityType: 'countEntry',
      entityId: '1',
      operation: 'update',
      payload: { quarters: 8 },
    })
    const sent = (await entry('countEntry:1'))!

    await markOutboxEntrySuccess(sent.id, sent.revision ?? 0)

    expect(await getPendingOutboxEntries()).toHaveLength(0)
  })

  it('laat een nieuwere mutatie niet wachten op de backoff van een oudere', async () => {
    await addToOutbox({
      id: 'countEntry:1',
      entityType: 'countEntry',
      entityId: '1',
      operation: 'update',
      payload: { quarters: 8 },
    })
    const inFlight = (await entry('countEntry:1'))!

    await addToOutbox({
      id: 'countEntry:1',
      entityType: 'countEntry',
      entityId: '1',
      operation: 'update',
      payload: { quarters: 12 },
    })
    await markOutboxEntryFailed(inFlight.id, 'Netwerkfout', {
      revision: inFlight.revision ?? 0,
    })

    const remaining = (await entry('countEntry:1'))!
    expect(remaining.payload).toEqual({ quarters: 12 })
    expect(remaining.attempts).toBe(0)
    expect(remaining.nextAttemptAt).toBeUndefined()
  })
})
