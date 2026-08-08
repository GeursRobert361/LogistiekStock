import type {
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
  RestockDelivery,
  StockReservation,
} from '@/types'

export interface ReserveRoundInput {
  /** De ronde die wordt aangemaakt zodra er iets te reserveren blijkt. */
  round: Omit<RestockRound, 'createdAt' | 'updatedAt'>
  /** Kiosken van de ring waar deze ronde doorheen rijdt. */
  kioskIds: string[]
  productIds: string[]
}

export type ReserveRoundResult =
  | {
      ok: true
      round: RestockRound
      items: RestockRoundItem[]
      reservations: StockReservation[]
    }
  /** Alles was al gereserveerd of geleverd tegen de tijd dat we de rijen hadden. */
  | { ok: false; reason: 'NOTHING_AVAILABLE' }

export interface RegisterDeliveryInput {
  /** De levering, met het id dat de client heeft gemaakt. */
  delivery: RestockDelivery
  roundId: string
  /** Behoefte waar deze levering op afboekt, als die bekend is. */
  requirementId?: string
}

export interface RegisterDeliveryResult {
  delivery: RestockDelivery
  /** False wanneer deze levering er al was; er is dan niets bijgeteld. */
  isNew: boolean
  requirement: RestockRequirement | null
  roundItem: RestockRoundItem | null
}

export interface IRestockRepository {
  // ─── Behoeften (bijvullijst) ───────────────────────────────────────────────
  getRequirements(eventId: string): Promise<RestockRequirement[]>
  upsertRequirement(
    data: Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRequirement>
  bulkUpsertRequirements(
    data: Array<Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<RestockRequirement[]>
  updateRequirement(id: string, data: Partial<RestockRequirement>): Promise<RestockRequirement>

  // ─── Vulrondes ─────────────────────────────────────────────────────────────
  getRounds(eventId: string): Promise<RestockRound[]>
  getRoundById(id: string): Promise<RestockRound | null>
  createRound(data: Omit<RestockRound, 'createdAt' | 'updatedAt'>): Promise<RestockRound>
  updateRound(id: string, data: Partial<RestockRound>): Promise<RestockRound>

  getRoundItems(roundId: string): Promise<RestockRoundItem[]>
  upsertRoundItem(
    data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRoundItem>

  getRoundStops(roundId: string): Promise<RestockRoundStop[]>
  createRoundStops(stops: Array<Omit<RestockRoundStop, 'id'>>): Promise<RestockRoundStop[]>
  updateStop(stopId: string, data: Partial<RestockRoundStop>): Promise<RestockRoundStop>
  deleteRoundStops(roundId: string): Promise<void>

  getStopItems(stopId: string): Promise<RestockStopItem[]>
  getStopItemsForRound(roundId: string): Promise<RestockStopItem[]>
  createStopItems(items: Array<Omit<RestockStopItem, 'id' | 'createdAt'>>): Promise<RestockStopItem[]>

  // ─── Leveringen ────────────────────────────────────────────────────────────
  /**
   * Legt een levering vast. Het id komt van de client en de aanroep is
   * idempotent: dezelfde levering twee keer wegschrijven — rechtstreeks én
   * later nog eens vanuit de outbox — levert één regel op.
   */
  createDelivery(data: RestockDelivery): Promise<RestockDelivery>
  /**
   * Legt een levering vast en boekt hem in één transactie af.
   *
   * De levering, de behoefte, de reservering en het rondepost-totaal horen bij
   * elkaar: strandt het halverwege, dan staat er een levering die nergens op is
   * afgeboekt en blijft de voorraad gereserveerd terwijl hij al op de kiosk
   * staat. Alles slaagt, of niets.
   *
   * Idempotent op het id van de levering: een tweede aanbieding — rechtstreeks
   * of later vanuit de outbox — telt niets bij en geeft `isNew: false`.
   */
  registerDeliveryAtomic(input: RegisterDeliveryInput): Promise<RegisterDeliveryResult>
  getDeliveriesForStop(stopId: string): Promise<RestockDelivery[]>
  getDeliveriesForRound(roundId: string): Promise<RestockDelivery[]>

  // ─── Reserveringen ─────────────────────────────────────────────────────────
  /**
   * Maakt een vulronde en reserveert de bijbehorende voorraad in één keer.
   *
   * Het vrije aantal (nodig − geleverd − gereserveerd) wordt hierbinnen
   * opnieuw berekend, met de behoefterijen vergrendeld. Twee vullers die op
   * hetzelfde moment dezelfde 10 pakken willen pakken, krijgen daardoor samen
   * niet meer dan 10: de tweede ziet wat de eerste net heeft vastgelegd.
   *
   * Lukt er niets meer, dan wordt er ook geen ronde aangemaakt.
   */
  reserveRoundAtomic(input: ReserveRoundInput): Promise<ReserveRoundResult>
  createReservation(data: Omit<StockReservation, 'id' | 'createdAt'>): Promise<StockReservation>
  getReservationsForRound(roundId: string): Promise<StockReservation[]>
  getReservationsForEvent(eventId: string): Promise<StockReservation[]>
  releaseReservation(roundId: string, requirementId: string): Promise<void>
  releaseReservationsForRound(roundId: string): Promise<void>
}
