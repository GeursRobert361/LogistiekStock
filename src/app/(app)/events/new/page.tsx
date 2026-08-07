'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { kioskLabel } from '@/lib/kiosk'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AccessDenied } from '@/components/auth/RequireRole'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { PERMISSIONS } from '@/lib/permissions'
import { EVENT_TYPE_LABEL } from '@/lib/eventLabels'
import { formatDate, todayIso } from '@/lib/utils'
import { EventStatus, EventType } from '@/types'
import type { AgendaEntry, Kiosk, Ring } from '@/types'

/**
 * De agendaregel die net is geweest en die eraan komt.
 *
 * Meer keuze is hier niet nodig: je maakt een evenement aan op de dag zelf of
 * vlak ervoor. Staat er niets in de agenda, dan vul je het gewoon zelf in.
 */
function pickAround(entries: AgendaEntry[]): {
  previous?: AgendaEntry
  next?: AgendaEntry
} {
  const today = todayIso()
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return {
    previous: [...sorted].reverse().find((entry) => entry.date < today),
    next: sorted.find((entry) => entry.date >= today),
  }
}

export default function NewEventPage() {
  const router = useRouter()
  const { profile, hasAnyRole } = useAuth()

  const [rings, setRings] = useState<Ring[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [eventType, setEventType] = useState<EventType>(EventType.VOETBAL)
  const [notes, setNotes] = useState('')
  const [agenda, setAgenda] = useState<AgendaEntry[]>([])
  const [selectedRingIds, setSelectedRingIds] = useState<Set<string>>(new Set())
  const [closedKioskIds, setClosedKioskIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = hasAnyRole([...PERMISSIONS.MANAGE_EVENTS])

  useEffect(() => {
    Promise.all([
      repositories.kiosk().getRings(),
      repositories.kiosk().getKiosks(),
      repositories.event().getAgenda(),
    ])
      .then(([ringList, kioskList, agendaList]) => {
        setRings(ringList)
        setKiosks(kioskList)
        setAgenda(agendaList)
        setSelectedRingIds(new Set(ringList.map((ring) => ring.id)))

        // De eerstvolgende agendaregel is verreweg de meest waarschijnlijke.
        const next = pickAround(agendaList).next
        if (next) applyAgendaEntry(next)
        setIsLoading(false)
      })
      .catch((loadError: unknown) => {
        console.error('[evenement] Laden mislukt.', loadError)
        setError('De ringen en kiosken konden niet worden geladen.')
        setIsLoading(false)
      })
  }, [])

  function applyAgendaEntry(entry: AgendaEntry) {
    setName(entry.name)
    setDate(entry.date)
    setEventType(entry.eventType)
    if (entry.notes) setNotes(entry.notes)
  }

  if (!canManage) return <AccessDenied />

  /** Kiosken van de gekozen ringen, minus de kiosken die dicht blijven. */
  const kiosksInSelectedRings = kiosks.filter((kiosk) => selectedRingIds.has(kiosk.ringId))
  const openKiosks = kiosksInSelectedRings.filter((kiosk) => !closedKioskIds.has(kiosk.id))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return

    if (!name.trim()) {
      setError('Geef het evenement een naam.')
      return
    }
    if (openKiosks.length === 0) {
      setError('Er moet minstens één kiosk open zijn.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const event = await repositories.event().createEvent({
        name: name.trim(),
        date,
        eventType,
        status: EventStatus.READY_FOR_COUNTING,
        notes: notes.trim() || undefined,
        activeRingIds: [...selectedRingIds],
        activeKioskIds: openKiosks.map((kiosk) => kiosk.id),
        assignedUserIds: [],
        createdById: profile.id,
      })
      router.push(`/events/${event.id}`)
    } catch (submitError) {
      console.error('[evenement] Aanmaken mislukt.', submitError)
      setError('Het evenement kon niet worden aangemaakt.')
      setIsSaving(false)
    }
  }

  function toggleRing(ringId: string) {
    setSelectedRingIds((previous) => {
      const next = new Set(previous)
      if (next.has(ringId)) next.delete(ringId)
      else next.add(ringId)
      return next
    })
  }

  function toggleKiosk(kioskId: string) {
    setClosedKioskIds((previous) => {
      const next = new Set(previous)
      if (next.has(kioskId)) next.delete(kioskId)
      else next.add(kioskId)
      return next
    })
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Nieuw evenement" backHref="/events" />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Nieuw evenement" backHref="/events" />
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <AgendaPicker
          agenda={agenda}
          selectedName={name}
          selectedDate={date}
          onPick={applyAgendaEntry}
        />

        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} />

        <Input
          label="Datum"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Select
          label="Soort"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
          options={Object.values(EventType).map((value) => ({
            value,
            label: EVENT_TYPE_LABEL[value],
          }))}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">Ringen in gebruik</legend>
          <div className="space-y-2">
            {rings.map((ring) => (
              <label
                key={ring.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
                  selectedRingIds.has(ring.id)
                    ? 'border-arena-red bg-red-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRingIds.has(ring.id)}
                  onChange={() => toggleRing(ring.id)}
                  className="h-5 w-5 accent-arena-red"
                />
                <span className="text-sm font-medium text-gray-900">{ring.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">
            Gesloten kiosken ({closedKioskIds.size})
          </legend>
          <p className="mb-2 text-xs text-gray-600">
            Tik een kiosk aan om hem dicht te zetten. Gesloten kiosken worden niet geteld en niet
            gevuld.
          </p>
          <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
            {kiosksInSelectedRings.map((kiosk) => (
              <button
                key={kiosk.id}
                type="button"
                onClick={() => toggleKiosk(kiosk.id)}
                aria-pressed={closedKioskIds.has(kiosk.id)}
                className={`min-h-11 rounded-lg border px-1 font-medium leading-tight ${
                  kioskLabel(kiosk).length > 4 ? 'text-xs' : 'text-sm'
                } ${
                  closedKioskIds.has(kiosk.id)
                    ? 'border-gray-400 bg-gray-200 text-gray-500 line-through'
                    : 'border-gray-300 bg-white text-gray-800'
                }`}
              >
                {kioskLabel(kiosk)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-600">{openKiosks.length} kiosken open</p>
        </fieldset>

        <div>
          <label htmlFor="event-notes" className="mb-1 block text-sm font-medium text-gray-700">
            Notities
          </label>
          <textarea
            id="event-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
          {isSaving ? 'Bezig…' : 'Evenement aanmaken'}
        </Button>
      </form>
    </>
  )
}

/**
 * Kiezen uit de agenda in plaats van overtypen. Alleen de regel die net is
 * geweest en de eerstvolgende; de rest van de kalender hoort in het beheer.
 */
function AgendaPicker({
  agenda,
  selectedName,
  selectedDate,
  onPick,
}: {
  agenda: AgendaEntry[]
  selectedName: string
  selectedDate: string
  onPick: (entry: AgendaEntry) => void
}) {
  const { previous, next } = pickAround(agenda)
  const options = [
    previous ? { entry: previous, label: 'Vorige' } : null,
    next ? { entry: next, label: 'Volgende' } : null,
  ].filter((option): option is { entry: AgendaEntry; label: string } => option !== null)

  if (options.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-600">
        De agenda is leeg. Vul hem in onder Beheer → Agenda, dan hoef je naam en datum hier niet
        meer over te typen.
      </p>
    )
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-gray-700">Uit de agenda</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ entry, label }) => {
          const isSelected = entry.name === selectedName && entry.date === selectedDate
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry)}
              aria-pressed={isSelected}
              className={`min-h-16 rounded-xl border px-3 py-2 text-left ${
                isSelected ? 'border-arena-red bg-red-50' : 'border-gray-300 bg-white'
              }`}
            >
              <span
                className={`block text-xs font-semibold uppercase tracking-wide ${
                  isSelected ? 'text-arena-red' : 'text-gray-500'
                }`}
              >
                {isSelected ? `✓ ${label}` : label}
              </span>
              <span className="block truncate text-sm font-semibold text-gray-900">
                {entry.name}
              </span>
              <span className="block text-xs text-gray-600">{formatDate(entry.date)}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Of vul hieronder zelf iets in. Beheer → Agenda houdt de kalender bij.
      </p>
    </fieldset>
  )
}
