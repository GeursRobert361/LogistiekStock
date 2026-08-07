import type { IAuthRepository } from './interfaces/IAuthRepository'
import type { IKioskRepository } from './interfaces/IKioskRepository'
import type { IProductRepository } from './interfaces/IProductRepository'
import type { IEventRepository } from './interfaces/IEventRepository'
import type { ICountRepository } from './interfaces/ICountRepository'
import type { IRestockRepository } from './interfaces/IRestockRepository'
import type { IIncidentRepository } from './interfaces/IIncidentRepository'

import { DemoAuthRepository } from './demo/DemoAuthRepository'
import { DemoKioskRepository } from './demo/DemoKioskRepository'
import { DemoProductRepository } from './demo/DemoProductRepository'
import { DemoEventRepository } from './demo/DemoEventRepository'
import { DemoCountRepository } from './demo/DemoCountRepository'
import { DemoRestockRepository } from './demo/DemoRestockRepository'
import { DemoIncidentRepository } from './demo/DemoIncidentRepository'

import { HttpAuthRepository } from './http/HttpAuthRepository'
import { createRpcRepository } from './http/rpcClient'

import { isDemoMode } from '@/lib/appMode'

/**
 * Centrale plek waar demo- en productie-implementaties worden gekozen.
 *
 * Pages en componenten praten alleen met de interfaces. In demo-modus draait
 * alles in de browser; in productie gaat elke aanroep via /api/rpc naar de
 * Postgres op onze eigen server, waar de rechten worden gecontroleerd.
 */

let authRepo: IAuthRepository | null = null
let kioskRepo: IKioskRepository | null = null
let productRepo: IProductRepository | null = null
let eventRepo: IEventRepository | null = null
let countRepo: ICountRepository | null = null
let restockRepo: IRestockRepository | null = null
let incidentRepo: IIncidentRepository | null = null

function getAuthRepository(): IAuthRepository {
  if (!authRepo) {
    authRepo = isDemoMode() ? new DemoAuthRepository() : new HttpAuthRepository()
  }
  return authRepo
}

function getKioskRepository(): IKioskRepository {
  if (!kioskRepo) {
    kioskRepo = isDemoMode()
      ? new DemoKioskRepository()
      : createRpcRepository<IKioskRepository>('kiosk')
  }
  return kioskRepo
}

function getProductRepository(): IProductRepository {
  if (!productRepo) {
    productRepo = isDemoMode()
      ? new DemoProductRepository()
      : createRpcRepository<IProductRepository>('product')
  }
  return productRepo
}

function getEventRepository(): IEventRepository {
  if (!eventRepo) {
    eventRepo = isDemoMode()
      ? new DemoEventRepository()
      : createRpcRepository<IEventRepository>('event')
  }
  return eventRepo
}

function getCountRepository(): ICountRepository {
  if (!countRepo) {
    countRepo = isDemoMode()
      ? new DemoCountRepository()
      : createRpcRepository<ICountRepository>('count')
  }
  return countRepo
}

function getRestockRepository(): IRestockRepository {
  if (!restockRepo) {
    restockRepo = isDemoMode()
      ? new DemoRestockRepository()
      : createRpcRepository<IRestockRepository>('restock')
  }
  return restockRepo
}

function getIncidentRepository(): IIncidentRepository {
  if (!incidentRepo) {
    incidentRepo = isDemoMode()
      ? new DemoIncidentRepository()
      : createRpcRepository<IIncidentRepository>('incident')
  }
  return incidentRepo
}

export const repositories = {
  auth: getAuthRepository,
  kiosk: getKioskRepository,
  product: getProductRepository,
  event: getEventRepository,
  count: getCountRepository,
  restock: getRestockRepository,
  incident: getIncidentRepository,
}

export type {
  IAuthRepository,
  IKioskRepository,
  IProductRepository,
  IEventRepository,
  ICountRepository,
  IRestockRepository,
  IIncidentRepository,
}
