import type { Permission } from '@/lib/permissions'

/**
 * Welk recht elke aanroep nodig heeft.
 *
 * De API is één ingang die naar de repositories dispatcht. Zonder deze tabel
 * zou dat een open doorgeefluik naar de database zijn. Daarom:
 *
 *   - alles wat hier niet in staat wordt geweigerd (standaard dicht);
 *   - een test controleert dat élke methode van élke repository-interface een
 *     regel heeft, zodat een nieuwe methode niet per ongeluk onbeschermd blijft.
 *
 * `AUTHENTICATED` betekent: elke ingelogde gebruiker mag dit. Dat geldt voor
 * stamdata die iedereen op de vloer nodig heeft — kiosknummers, producten,
 * normen — en niet voor iets gevoeligs.
 */
export type MethodRule = Permission | 'AUTHENTICATED'

export const METHOD_PERMISSIONS: Record<string, MethodRule> = {
  // ─── auth ────────────────────────────────────────────────────────────────
  'auth.listProfiles': 'MANAGE_MASTER_DATA',

  // ─── kiosk & ring ────────────────────────────────────────────────────────
  'kiosk.getRings': 'AUTHENTICATED',
  'kiosk.getRingById': 'AUTHENTICATED',
  'kiosk.createRing': 'MANAGE_MASTER_DATA',
  'kiosk.updateRing': 'MANAGE_MASTER_DATA',
  'kiosk.getKiosks': 'AUTHENTICATED',
  'kiosk.getKioskById': 'AUTHENTICATED',
  'kiosk.getKiosksByEvent': 'AUTHENTICATED',
  'kiosk.createKiosk': 'MANAGE_MASTER_DATA',
  'kiosk.updateKiosk': 'MANAGE_MASTER_DATA',
  'kiosk.deleteKiosk': 'MANAGE_MASTER_DATA',
  'kiosk.updateEventKiosks': 'MANAGE_EVENTS',

  // ─── product, categorie & norm ───────────────────────────────────────────
  'product.getCategories': 'AUTHENTICATED',
  'product.createCategory': 'MANAGE_MASTER_DATA',
  'product.updateCategory': 'MANAGE_MASTER_DATA',
  'product.getProducts': 'AUTHENTICATED',
  'product.getProductById': 'AUTHENTICATED',
  'product.createProduct': 'MANAGE_MASTER_DATA',
  'product.updateProduct': 'MANAGE_MASTER_DATA',
  'product.deleteProduct': 'MANAGE_MASTER_DATA',
  'product.getStandards': 'AUTHENTICATED',
  'product.getStandardMatrix': 'AUTHENTICATED',
  'product.upsertStandard': 'MANAGE_STANDARDS',
  'product.bulkUpsertStandards': 'MANAGE_STANDARDS',

  // ─── evenement ───────────────────────────────────────────────────────────
  'event.getEvents': 'AUTHENTICATED',
  'event.getEventById': 'AUTHENTICATED',
  'event.createEvent': 'MANAGE_EVENTS',
  'event.updateEvent': 'MANAGE_EVENTS',
  'event.updateEventStatus': 'MANAGE_EVENTS',
  'event.deleteEvent': 'MANAGE_EVENTS',
  // De agenda mag iedereen lezen — je kiest eruit bij het aanmaken van een
  // evenement. Vullen doet de planner.
  'event.getAgenda': 'AUTHENTICATED',
  'event.upsertAgendaEntry': 'MANAGE_EVENTS',
  'event.deleteAgendaEntry': 'MANAGE_EVENTS',

  // ─── tellen ──────────────────────────────────────────────────────────────
  'count.getSessions': 'AUTHENTICATED',
  'count.getSessionById': 'AUTHENTICATED',
  'count.createSession': 'COUNT',
  'count.updateSession': 'COUNT',
  'count.updateSessionStatus': 'COUNT',
  'count.getKioskCountsForSession': 'AUTHENTICATED',
  'count.upsertKioskCount': 'COUNT',
  'count.getEntriesForKioskCount': 'AUTHENTICATED',
  'count.getEntriesForSession': 'AUTHENTICATED',
  'count.upsertCountEntry': 'COUNT',
  'count.bulkUpsertCountEntries': 'COUNT',
  'count.deleteCountEntry': 'COUNT',

  // ─── bijvullen ───────────────────────────────────────────────────────────
  'restock.getRequirements': 'AUTHENTICATED',
  // Behoeften ontstaan uit een goedgekeurde telling; alleen wie mag goedkeuren
  // schrijft ze integraal weg.
  'restock.upsertRequirement': 'REVIEW_COUNTS',
  'restock.bulkUpsertRequirements': 'REVIEW_COUNTS',
  // Een vuller raakt hier alleen aan bij het vrijgeven van zijn eigen
  // reserveringen; welke behoefte dat mag zijn staat in entityGuards.
  'restock.updateRequirement': 'EXECUTE_RESTOCK',
  'restock.getRounds': 'AUTHENTICATED',
  'restock.getRoundById': 'AUTHENTICATED',
  // Een vuller stelt zijn eigen pallet samen: pakken, aanvinken, rijden. Al het
  // schrijfwerk dat daarbij hoort staat op COMPOSE_PALLET.
  'restock.createRound': 'COMPOSE_PALLET',
  'restock.updateRound': 'EXECUTE_RESTOCK',
  'restock.getRoundItems': 'AUTHENTICATED',
  'restock.upsertRoundItem': 'EXECUTE_RESTOCK',
  'restock.getRoundStops': 'AUTHENTICATED',
  'restock.createRoundStops': 'COMPOSE_PALLET',
  'restock.updateStop': 'EXECUTE_RESTOCK',
  'restock.deleteRoundStops': 'COMPOSE_PALLET',
  'restock.getStopItems': 'AUTHENTICATED',
  'restock.getStopItemsForRound': 'AUTHENTICATED',
  'restock.createStopItems': 'COMPOSE_PALLET',
  'restock.createDelivery': 'EXECUTE_RESTOCK',
  'restock.registerDeliveryAtomic': 'EXECUTE_RESTOCK',
  'restock.getDeliveriesForStop': 'AUTHENTICATED',
  'restock.getDeliveriesForRound': 'AUTHENTICATED',
  // Ronde maken én de voorraad ervoor vastleggen is één handeling; het recht
  // is hetzelfde als voor de losse stappen die het vervangt.
  'restock.reserveRoundAtomic': 'COMPOSE_PALLET',
  'restock.createReservation': 'COMPOSE_PALLET',
  'restock.getReservationsForRound': 'AUTHENTICATED',
  'restock.getReservationsForEvent': 'AUTHENTICATED',
  'restock.releaseReservation': 'EXECUTE_RESTOCK',
  'restock.releaseReservationsForRound': 'EXECUTE_RESTOCK',

  // ─── storingen ───────────────────────────────────────────────────────────
  'incident.getIncidents': 'INCIDENTS',
  'incident.getIncidentById': 'INCIDENTS',
  'incident.createIncident': 'INCIDENTS',
  // De melder mag zijn eigen openstaande melding bijstellen; status en
  // toewijzing blijven bij de planner. Dat onderscheid staat in entityGuards,
  // omdat het van de melding zelf afhangt en niet van de rol alleen.
  'incident.updateIncident': 'INCIDENTS',
}

/** Methodes die de client niet via de API mag aanroepen. */
export const CLIENT_ONLY_METHODS = new Set([
  // Inloggen en uitloggen lopen via eigen endpoints met cookie-afhandeling.
  'auth.login',
  'auth.logout',
  'auth.getCurrentSession',
  'auth.getCurrentProfile',
  'auth.onAuthStateChange',
])

export function getMethodRule(resource: string, method: string): MethodRule | null {
  return METHOD_PERMISSIONS[`${resource}.${method}`] ?? null
}
