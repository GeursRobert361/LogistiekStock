/**
 * Persistente opslag voor demo-modus.
 *
 * In demo-modus is er geen echte server. De Demo-repositories gedragen zich
 * daarom als "de server": ze moeten een page reload overleven, anders is een
 * telronde na F5 verdwenen en kan de review-/vulplanning er niets mee.
 *
 * Deze store schrijft naar localStorage. IndexedDB (`lib/db/offlineDb`) blijft
 * de offline-cache van de *client*; deze store is de gesimuleerde *server*.
 */

// Voorvoegsel houdt de oude naam, ook nu de app StockFlow heet: het is de
// sleutel waaronder bestaande demo-data in localStorage staat, en die weggooien
// om cosmetische redenen wist een lopende demo-telronde.
const STORAGE_PREFIX = 'logistiekstock.demo.v1.'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`[demoStore] Kon "${key}" niet lezen, val terug op seed.`, error)
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // Quota vol of private mode: de in-memory cache blijft werken, alleen
    // niet meer persistent. Nooit stil doorslikken.
    console.error(`[demoStore] Kon "${key}" niet opslaan.`, error)
  }
}

/**
 * Een tabel met records die op `id` uniek zijn.
 *
 * De inhoud wordt lui geladen: bij de eerste toegang uit localStorage, en
 * anders uit `seed()`. Alle schrijfacties persisteren direct.
 */
export class DemoTable<T extends { id: string }> {
  private cache: T[] | null = null

  constructor(
    private readonly name: string,
    private readonly seed: () => T[]
  ) {}

  private get storageKey(): string {
    return STORAGE_PREFIX + this.name
  }

  private load(): T[] {
    if (this.cache !== null) return this.cache
    const stored = readJson<T[]>(this.storageKey)
    if (stored !== null) {
      this.cache = stored
    } else {
      this.cache = this.seed()
      writeJson(this.storageKey, this.cache)
    }
    return this.cache
  }

  private persist(): void {
    writeJson(this.storageKey, this.cache ?? [])
  }

  /** Alle records (kopie — muteren van het resultaat raakt de store niet). */
  all(): T[] {
    return [...this.load()]
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.load().filter(predicate)
  }

  find(predicate: (item: T) => boolean): T | null {
    return this.load().find(predicate) ?? null
  }

  getById(id: string): T | null {
    return this.find((item) => item.id === id)
  }

  insert(item: T): T {
    const items = this.load()
    items.push(item)
    this.persist()
    return item
  }

  /** Vervangt het record met hetzelfde id, of voegt het toe. */
  put(item: T): T {
    const items = this.load()
    const index = items.findIndex((existing) => existing.id === item.id)
    if (index === -1) {
      items.push(item)
    } else {
      items[index] = item
    }
    this.persist()
    return item
  }

  putMany(newItems: T[]): void {
    const items = this.load()
    for (const item of newItems) {
      const index = items.findIndex((existing) => existing.id === item.id)
      if (index === -1) {
        items.push(item)
      } else {
        items[index] = item
      }
    }
    this.persist()
  }

  /** Past een bestaand record aan. Gooit wanneer het niet bestaat. */
  update(id: string, patch: Partial<T>): T {
    const items = this.load()
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) {
      throw new Error(`[demoStore] ${this.name}: record niet gevonden (${id})`)
    }
    const updated = { ...items[index]!, ...patch }
    items[index] = updated
    this.persist()
    return updated
  }

  remove(id: string): void {
    const items = this.load().filter((item) => item.id !== id)
    this.cache = items
    this.persist()
  }

  /** Alleen voor tests / "demo resetten". */
  reset(): void {
    this.cache = this.seed()
    this.persist()
  }
}

/** Verwijdert alle demo-data uit localStorage (gebruikt door "Demo resetten"). */
export function clearDemoStorage(): void {
  if (!isBrowser()) return
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key !== null && key.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  for (const key of keys) window.localStorage.removeItem(key)
}
