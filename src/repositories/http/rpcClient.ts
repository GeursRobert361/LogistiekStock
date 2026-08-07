/**
 * Praat met /api/rpc. De browser krijgt nooit databasegegevens te zien; de
 * server bepaalt wat mag.
 */

export class RpcError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'RpcError'
  }
}

async function call<T>(resource: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ resource, method, args }),
  })

  if (!response.ok) {
    let message = 'De bewerking is mislukt.'
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Geen JSON terug — de standaardmelding volstaat.
    }
    throw new RpcError(message, response.status)
  }

  const body = (await response.json()) as { data: T }
  return body.data
}

/**
 * Bouwt een object dat de repository-interface nadoet: elke aangeroepen
 * methode wordt doorgestuurd naar de server.
 *
 * Een Proxy in plaats van zeven handgeschreven klassen: die zouden alleen
 * maar dezelfde regel herhalen, en bij elke nieuwe interfacemethode opnieuw
 * bijgewerkt moeten worden.
 */
export function createRpcRepository<T extends object>(resource: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      if (typeof property !== 'string') return undefined
      return (...args: unknown[]) => call(resource, property, args)
    },
  })
}
