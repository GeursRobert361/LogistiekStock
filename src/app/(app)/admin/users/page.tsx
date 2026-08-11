'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { UserForm, type UserFormValues } from '@/components/admin/UserForm'
import { repositories } from '@/repositories'
import { generatePassword } from '@/lib/password'
import type { Profile } from '@/types'
import { UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.PLANNER]: 'Planner',
  [UserRole.TELLER]: 'Teller',
  [UserRole.VULLER]: 'Vuller',
}

/** Welk venster er open staat. */
type Scherm =
  | { soort: 'geen' }
  | { soort: 'nieuw' }
  | { soort: 'bewerken'; profiel: Profile }
  | { soort: 'wachtwoord'; profiel: Profile }
  | { soort: 'getoond'; profiel: Profile; wachtwoord: string }

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scherm, setScherm] = useState<Scherm>({ soort: 'geen' })
  const [fout, setFout] = useState<string | null>(null)

  const laden = useCallback(async () => {
    const lijst = await repositories.auth().listProfiles()
    setProfiles(lijst)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    laden().catch((error: unknown) => {
      console.error('[beheer] Gebruikers laden mislukt.', error)
      setFout('De gebruikers konden niet worden geladen.')
      setIsLoading(false)
    })
  }, [laden])

  async function maakAan(values: UserFormValues) {
    const profiel = await repositories.auth().createProfile({
      email: values.email,
      displayName: values.displayName,
      password: values.password,
      roles: values.roles,
    })
    await laden()
    // Eén keer tonen: hierna is het wachtwoord alleen nog opnieuw in te stellen.
    setScherm({ soort: 'getoond', profiel, wachtwoord: values.password })
  }

  async function bewerk(profiel: Profile, values: UserFormValues) {
    await repositories.auth().updateProfile(profiel.id, {
      email: values.email,
      displayName: values.displayName,
      roles: values.roles,
    })
    await laden()
    setScherm({ soort: 'geen' })
  }

  async function zetActief(profiel: Profile, isActief: boolean) {
    setFout(null)
    try {
      await repositories.auth().setActive(profiel.id, isActief)
      await laden()
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'De wijziging is mislukt.')
    }
  }

  return (
    <>
      <AppHeader title="Gebruikers" backHref="/dashboard" />

      <div className="space-y-3 p-4">
        <Button onClick={() => setScherm({ soort: 'nieuw' })} className="w-full">
          Nieuw account
        </Button>

        {fout && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            {fout}
          </p>
        )}

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : profiles.length === 0 ? (
          <EmptyState title="Geen gebruikers" icon="👥" />
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="space-y-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{profile.displayName}</p>
                    <p className="truncate text-sm text-gray-600">{profile.email}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                    {profile.roles.map((role) => (
                      <Badge key={role} variant={role === UserRole.ADMIN ? 'arena' : 'default'}>
                        {ROLE_LABEL[role] ?? role}
                      </Badge>
                    ))}
                    {!profile.isActive && <Badge variant="default">Inactief</Badge>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScherm({ soort: 'bewerken', profiel: profile })}
                  >
                    Bewerken
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScherm({ soort: 'wachtwoord', profiel: profile })}
                  >
                    Wachtwoord
                  </Button>
                  {profile.isActive ? (
                    <Button variant="ghost" size="sm" onClick={() => zetActief(profile, false)}>
                      Deactiveren
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => zetActief(profile, true)}>
                      Heractiveren
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {scherm.soort === 'nieuw' && (
        <Dialog open onClose={() => setScherm({ soort: 'geen' })} title="Nieuw account">
          <UserForm onSubmit={maakAan} onCancel={() => setScherm({ soort: 'geen' })} />
        </Dialog>
      )}

      {scherm.soort === 'bewerken' && (
        <Dialog open onClose={() => setScherm({ soort: 'geen' })} title="Account bewerken">
          <UserForm
            profile={scherm.profiel}
            onSubmit={(values) => bewerk(scherm.profiel, values)}
            onCancel={() => setScherm({ soort: 'geen' })}
          />
        </Dialog>
      )}

      {scherm.soort === 'wachtwoord' && (
        <WachtwoordDialog
          profiel={scherm.profiel}
          onKlaar={(wachtwoord) =>
            setScherm({ soort: 'getoond', profiel: scherm.profiel, wachtwoord })
          }
          onClose={() => setScherm({ soort: 'geen' })}
        />
      )}

      {scherm.soort === 'getoond' && (
        <Dialog open onClose={() => setScherm({ soort: 'geen' })} title="Wachtwoord">
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Geef dit door aan {scherm.profiel.displayName}. Zodra je dit venster sluit is het niet
              meer op te vragen — alleen opnieuw in te stellen.
            </p>
            <p className="tabular select-all rounded-lg bg-concrete-light px-4 py-3 text-center text-2xl font-bold tracking-wide text-ink">
              {scherm.wachtwoord}
            </p>
            <Button onClick={() => setScherm({ soort: 'geen' })} className="w-full">
              Ik heb het genoteerd
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

/**
 * Een wachtwoord opnieuw instellen. Los van het bewerkformulier, zodat een
 * naam corrigeren niet per ongeluk iemand buitensluit.
 */
function WachtwoordDialog({
  profiel,
  onKlaar,
  onClose,
}: {
  profiel: Profile
  onKlaar: (wachtwoord: string) => void
  onClose: () => void
}) {
  const [wachtwoord, setWachtwoord] = useState(() => generatePassword())
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function opslaan() {
    setBezig(true)
    setFout(null)
    try {
      await repositories.auth().setPassword(profiel.id, wachtwoord)
      onKlaar(wachtwoord)
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Instellen is mislukt.')
      setBezig(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Wachtwoord voor ${profiel.displayName}`}>
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {profiel.displayName} wordt hierdoor overal uitgelogd en moet opnieuw inloggen met het
          nieuwe wachtwoord.
        </p>

        <p className="tabular select-all rounded-lg bg-concrete-light px-4 py-3 text-center text-2xl font-bold tracking-wide text-ink">
          {wachtwoord}
        </p>

        {fout && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            {fout}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={opslaan} disabled={bezig} className="flex-1">
            {bezig ? 'Bezig…' : 'Instellen'}
          </Button>
          <Button variant="outline" onClick={() => setWachtwoord(generatePassword())} disabled={bezig}>
            Nieuw
          </Button>
          <Button variant="outline" onClick={onClose} disabled={bezig}>
            Annuleren
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
