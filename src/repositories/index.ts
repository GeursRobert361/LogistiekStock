import type { IAuthRepository } from './interfaces/IAuthRepository'
import type { IKioskRepository } from './interfaces/IKioskRepository'
import type { IProductRepository } from './interfaces/IProductRepository'
import type { IEventRepository } from './interfaces/IEventRepository'
import type { ICountRepository } from './interfaces/ICountRepository'
import type { IRestockRepository } from './interfaces/IRestockRepository'

import { DemoAuthRepository } from './demo/DemoAuthRepository'
import { DemoKioskRepository } from './demo/DemoKioskRepository'
import { DemoProductRepository } from './demo/DemoProductRepository'
import { DemoEventRepository } from './demo/DemoEventRepository'
import { DemoCountRepository } from './demo/DemoCountRepository'

// Singletons — same instance throughout the app lifetime
let authRepo: IAuthRepository | null = null
let kioskRepo: IKioskRepository | null = null
let productRepo: IProductRepository | null = null
let eventRepo: IEventRepository | null = null
let countRepo: ICountRepository | null = null

function getAuthRepository(): IAuthRepository {
  if (!authRepo) {
    authRepo = new DemoAuthRepository()
    // TODO Phase 2: if (!isDemoMode) authRepo = new SupabaseAuthRepository(supabaseClient)
  }
  return authRepo
}

function getKioskRepository(): IKioskRepository {
  if (!kioskRepo) {
    kioskRepo = new DemoKioskRepository()
  }
  return kioskRepo
}

function getProductRepository(): IProductRepository {
  if (!productRepo) {
    productRepo = new DemoProductRepository()
  }
  return productRepo
}

function getEventRepository(): IEventRepository {
  if (!eventRepo) {
    eventRepo = new DemoEventRepository()
  }
  return eventRepo
}

function getCountRepository(): ICountRepository {
  if (!countRepo) {
    countRepo = new DemoCountRepository()
  }
  return countRepo
}

export const repositories = {
  auth: getAuthRepository,
  kiosk: getKioskRepository,
  product: getProductRepository,
  event: getEventRepository,
  count: getCountRepository,
}

export type { IAuthRepository, IKioskRepository, IProductRepository, IEventRepository, ICountRepository, IRestockRepository }
