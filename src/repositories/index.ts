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

import { SupabaseAuthRepository } from './supabase/SupabaseAuthRepository'
import { SupabaseKioskRepository } from './supabase/SupabaseKioskRepository'
import { SupabaseProductRepository } from './supabase/SupabaseProductRepository'
import { SupabaseEventRepository } from './supabase/SupabaseEventRepository'
import { SupabaseCountRepository } from './supabase/SupabaseCountRepository'
import { SupabaseRestockRepository } from './supabase/SupabaseRestockRepository'
import { SupabaseIncidentRepository } from './supabase/SupabaseIncidentRepository'

import { isDemoMode } from '@/lib/appMode'

/**
 * Centrale plek waar demo- en productie-implementaties worden gekozen.
 * Pages en componenten praten alleen met de interfaces — nooit rechtstreeks
 * met Supabase of met de demo-store.
 */

// Singletons — dezelfde instantie gedurende de hele app-levensduur
let authRepo: IAuthRepository | null = null
let kioskRepo: IKioskRepository | null = null
let productRepo: IProductRepository | null = null
let eventRepo: IEventRepository | null = null
let countRepo: ICountRepository | null = null
let restockRepo: IRestockRepository | null = null
let incidentRepo: IIncidentRepository | null = null

function getAuthRepository(): IAuthRepository {
  if (!authRepo) {
    authRepo = isDemoMode() ? new DemoAuthRepository() : new SupabaseAuthRepository()
  }
  return authRepo
}

function getKioskRepository(): IKioskRepository {
  if (!kioskRepo) {
    kioskRepo = isDemoMode() ? new DemoKioskRepository() : new SupabaseKioskRepository()
  }
  return kioskRepo
}

function getProductRepository(): IProductRepository {
  if (!productRepo) {
    productRepo = isDemoMode() ? new DemoProductRepository() : new SupabaseProductRepository()
  }
  return productRepo
}

function getEventRepository(): IEventRepository {
  if (!eventRepo) {
    eventRepo = isDemoMode() ? new DemoEventRepository() : new SupabaseEventRepository()
  }
  return eventRepo
}

function getCountRepository(): ICountRepository {
  if (!countRepo) {
    countRepo = isDemoMode() ? new DemoCountRepository() : new SupabaseCountRepository()
  }
  return countRepo
}

function getRestockRepository(): IRestockRepository {
  if (!restockRepo) {
    restockRepo = isDemoMode() ? new DemoRestockRepository() : new SupabaseRestockRepository()
  }
  return restockRepo
}

function getIncidentRepository(): IIncidentRepository {
  if (!incidentRepo) {
    incidentRepo = isDemoMode() ? new DemoIncidentRepository() : new SupabaseIncidentRepository()
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
