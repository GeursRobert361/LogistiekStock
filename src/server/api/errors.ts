/**
 * Fouten die de gebruiker wél mag zien.
 *
 * De API stuurt standaard "De bewerking is mislukt." terug: een databasefout
 * kan tabelnamen en constraints prijsgeven. Maar een geweigerde bewerking is
 * geen storing — "voor deze ring loopt al een telronde" is precies wat iemand
 * moet weten om verder te kunnen.
 *
 * De statuscode telt dubbel: de outbox blijft het bij een 5xx eindeloos
 * proberen, en bij een 4xx stopt hij en meldt het. Een bewerking die door een
 * bedrijfsregel geweigerd wordt gaat bij een volgende poging weer mis, dus die
 * hoort bij de tweede groep.
 */
export class BusinessRuleError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}

export function isBusinessRuleError(error: unknown): error is BusinessRuleError {
  return error instanceof BusinessRuleError
}
