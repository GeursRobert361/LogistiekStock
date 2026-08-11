'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { generatePassword, validatePassword } from '@/lib/password'
import { UserRole, type Profile } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Beheerder',
  [UserRole.PLANNER]: 'Planner',
  [UserRole.TELLER]: 'Teller',
  [UserRole.VULLER]: 'Vuller',
}

const ROLE_HINT: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Alles, inclusief gebruikers en normen',
  [UserRole.PLANNER]: 'Evenementen, normen, tellingen nakijken',
  [UserRole.TELLER]: 'Tellen',
  [UserRole.VULLER]: 'Bijvullen en pallets samenstellen',
}

export interface UserFormValues {
  email: string
  displayName: string
  roles: UserRole[]
  password: string
}

interface UserFormProps {
  /** Meegeven om te bewerken; weglaten om aan te maken. */
  profile?: Profile
  onSubmit: (values: UserFormValues) => Promise<void>
  onCancel: () => void
}

export function UserForm({ profile, onSubmit, onCancel }: UserFormProps) {
  const isNew = profile === undefined

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [roles, setRoles] = useState<UserRole[]>(profile?.roles ?? [UserRole.TELLER])
  // Alleen bij aanmaken: bij bewerken loopt een wachtwoord via de eigen knop,
  // zodat je een naam kunt corrigeren zonder iemand buiten te sluiten.
  const [password, setPassword] = useState(() => (isNew ? generatePassword() : ''))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function toggleRole(role: UserRole) {
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (displayName.trim() === '') return setError('Vul een naam in.')
    if (email.trim() === '') return setError('Vul een e-mailadres in.')
    if (roles.length === 0) return setError('Kies minstens één rol.')

    if (isNew) {
      const passwordError = validatePassword(password)
      if (passwordError) return setError(passwordError)
    }

    setIsSaving(true)
    try {
      await onSubmit({ email: email.trim(), displayName: displayName.trim(), roles, password })
    } catch (submitError) {
      // De melding van de server is voor de gebruiker geschreven en zegt meer
      // dan een algemeen "mislukt" — die tonen we dus letterlijk.
      setError(submitError instanceof Error ? submitError.message : 'Opslaan is mislukt.')
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Naam"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Jan de Vries"
        autoComplete="off"
      />

      <Input
        label="E-mailadres"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="jan@niettegeloven.com"
        autoComplete="off"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Rollen</legend>
        {Object.values(UserRole).map((role) => (
          <label
            key={role}
            className="flex items-start gap-3 rounded-lg border border-concrete-deep p-3"
          >
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => toggleRole(role)}
              className="mt-0.5 h-5 w-5 flex-shrink-0"
            />
            <span className="min-w-0">
              <span className="block font-medium text-ink">{ROLE_LABEL[role]}</span>
              <span className="block text-xs text-ink-muted">{ROLE_HINT[role]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {isNew && (
        <div className="space-y-2">
          <Input
            label="Wachtwoord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              Geef dit door aan de medewerker. Je ziet het hierna niet meer terug.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPassword(generatePassword())}
            >
              Nieuw
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving ? 'Bezig…' : isNew ? 'Account aanmaken' : 'Opslaan'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Annuleren
        </Button>
      </div>
    </form>
  )
}
