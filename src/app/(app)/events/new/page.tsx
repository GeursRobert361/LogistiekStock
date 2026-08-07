'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AccessDenied } from '@/components/auth/RequireRole'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { PERMISSIONS } from '@/lib/permissions'
import { EventStatus, EventType } from '@/types'
import type { Kiosk, Ring } from '@/types'

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  [EventType.VOETBAL]: 'Voetbal',
  [EventType.CONCERT]: 'Concert',
  [EventType.OVERIG]: 'Overig',
}

export default function NewEventPage() {
  const router = useRouter()
  const { profile, hasAnyRole } = useAuth()

  const [rings, setRings] = useState<Ring[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [eventType, setEventType] = useState<EventType>(EventType.VOETBAL)
  const [expectedAttendees, setExpectedAttendees] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedRingIds, setSelectedRingIds] = useState<Set<string>>(new Set())
  const [closedKioskIds, setClosedKioskIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = hasAnyRole([...PERMISSIONS.MANAGE_EVENTS])

  useEffect(() => {
    Promise.all([repositories.kiosk().getRings(), repositories.kiosk().getKiosks()])
      .then(([ringList, kioskList]) => {
        setRings(ringList)
        setKiosks(kioskList)
        setSelectedRingIds(new Set(ringList.map((ring) => ring.id)))
        setIsLoading(false)
      })
      .catch((loadError: unknown) => {
        console.error('[evenement] Laden mislukt.', loadError)
        setError('De ringen en kiosken konden niet worden geladen.')
        setIsLoading(false)
      })
  }, [])

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
      const attendees = Number.parseInt(expectedAttendees.replace(/\D/g, ''), 10)
      const event = await repositories.event().createEvent({
        name: name.trim(),
        date,
        eventType,
        status: EventStatus.READY_FOR_COUNTING,
        expectedAttendees: Number.isFinite(attendees) ? attendees : undefined,
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

        <Input
          label="Verwacht aantal bezoekers"
          inputMode="numeric"
          value={expectedAttendees}
          onChange={(e) => setExpectedAttendees(e.target.value)}
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
                className={`min-h-11 rounded-lg border text-sm font-medium ${
                  closedKioskIds.has(kiosk.id)
                    ? 'border-gray-400 bg-gray-200 text-gray-500 line-through'
                    : 'border-gray-300 bg-white text-gray-800'
                }`}
              >
                {kiosk.number}
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
