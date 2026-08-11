/**
 * Wachtwoorden die over te tikken zijn vanaf een briefje.
 *
 * De ploeg logt in op een telefoon, met een wachtwoord dat iemand anders heeft
 * voorgelezen of opgeschreven. Daarom geen `l`, `1`, `I`, `0` en `O` — dat zijn
 * de tekens die verkeerd worden overgenomen — en groepjes van vier met een
 * streepje ertussen, want een reeks van twaalf tekens raak je kwijt.
 *
 * Twaalf tekens uit een alfabet van 32 is zestig bits. Genoeg: inloggen loopt
 * over een begrensd eindpunt en de hash is bcrypt met cost 12.
 */

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const GROUPS = 3
const GROUP_LENGTH = 4

/** Werkt in de browser en in Node; beide kennen webcrypto. */
function randomIndex(max: number): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)

  // Modulo op een ruwe waarde maakt de eerste tekens iets waarschijnlijker.
  // Opnieuw trekken bij een waarde in de overloopstaart haalt die scheefheid
  // eruit; dat gebeurt zelden genoeg om niet te merken.
  const limit = Math.floor(0xffffffff / max) * max
  if (buffer[0]! >= limit) return randomIndex(max)

  return buffer[0]! % max
}

export function generatePassword(): string {
  const groups: string[] = []

  for (let group = 0; group < GROUPS; group++) {
    let value = ''
    for (let i = 0; i < GROUP_LENGTH; i++) {
      value += ALPHABET[randomIndex(ALPHABET.length)]
    }
    groups.push(value)
  }

  return groups.join('-')
}

/** Ondergrens voor een zelfgetypt wachtwoord. */
export const MIN_PASSWORD_LENGTH = 8

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Gebruik minstens ${MIN_PASSWORD_LENGTH} tekens.`
  }
  return null
}
