/**
 * Serialiseert taken per sleutel en houdt bij welke nog lopen.
 *
 * Waarom: twee snel op elkaar volgende wijzigingen aan hetzelfde product mogen
 * elkaar niet inhalen (dan wint de oudste waarde), en vóór het afronden van een
 * kiosk moet zeker zijn dat alle schrijfacties klaar zijn.
 */
export class KeyedQueue {
  private readonly chains = new Map<string, Promise<unknown>>()

  /** Voert `task` uit nadat eerdere taken met dezelfde sleutel klaar zijn. */
  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve()
    // Een mislukte eerdere taak mag de volgende niet blokkeren.
    const next = previous.then(task, task)
    this.chains.set(key, next)

    void next
      .catch(() => undefined)
      .then(() => {
        if (this.chains.get(key) === next) this.chains.delete(key)
      })

    return next
  }

  /** Wacht tot alle openstaande taken klaar zijn (ook de mislukte). */
  async flush(): Promise<void> {
    // Taken kunnen tijdens het wachten nieuwe taken toevoegen; blijf herhalen
    // tot de wachtrij echt leeg is.
    while (this.chains.size > 0) {
      await Promise.allSettled([...this.chains.values()])
    }
  }

  get pending(): number {
    return this.chains.size
  }
}
