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

/**
 * De methode mag, maar niet op dít record.
 *
 * De rechtentabel is de eerste laag: mag deze rol dit soort bewerkingen doen?
 * Dit is de tweede: gaat het om iets van deze gebruiker? Zonder die tweede laag
 * kan een teller met een geldig recht de telronde van een collega aanpassen,
 * puur door een ander id mee te sturen.
 */
export class ForbiddenError extends BusinessRuleError {
  constructor(message = 'Geen toegang tot deze actie.') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

/** De aanvraag klopt niet; opnieuw proberen met dezelfde inhoud heeft geen zin. */
export class ValidationError extends BusinessRuleError {
  constructor(message = 'Ongeldige invoer.') {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export function isBusinessRuleError(error: unknown): error is BusinessRuleError {
  return error instanceof BusinessRuleError
}
