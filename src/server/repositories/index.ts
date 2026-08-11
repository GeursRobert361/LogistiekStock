import { authRepository } from './auth'
import { kioskRepository } from './kiosk'
import { productRepository } from './product'
import { eventRepository } from './event'
import { countRepository } from './count'
import { restockRepository } from './restock'
import { incidentRepository } from './incident'

/**
 * De server-side repositories, op naam. Het API-eindpunt zoekt hier op wat de
 * client aanvraagt — na de rechtencontrole, nooit ervoor.
 */
export const serverRepositories = {
  auth: authRepository,
  kiosk: kioskRepository,
  product: productRepository,
  event: eventRepository,
  count: countRepository,
  restock: restockRepository,
  incident: incidentRepository,
} as const

export type ServerResource = keyof typeof serverRepositories
