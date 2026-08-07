'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { reportIncident, CATEGORY_LABEL, URGENCY_LABEL } from '@/services/incidentService'
import { fileToResizedDataUrl } from '@/lib/image'
import { IncidentCategory, IncidentUrgency } from '@/types'
import type { Event, Kiosk } from '@/types'

export default function NewIncidentPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader title="Storing melden" backHref="/incidents" />
          <div className="p-4 text-center text-gray-500">Laden…</div>
        </>
      }
    >
      <NewIncidentForm />
    </Suspense>
  )
}

function NewIncidentForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { profile } = useAuth()

  const [events, setEvents] = useState<Event[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [eventId, setEventId] = useState(searchParams.get('eventId') ?? '')
  const [kioskId, setKioskId] = useState(searchParams.get('kioskId') ?? '')
  const [category, setCategory] = useState<IncidentCategory>(IncidentCategory.BIERTAP)
  const [urgency, setUrgency] = useState<IncidentUrgency>(IncidentUrgency.NORMAL)
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([repositories.event().getEvents(), repositories.kiosk().getKiosks()])
      .then(([eventList, kioskList]) => {
        setEvents(eventList)
        setKiosks(kioskList)
        setEventId((current) => current || (eventList[0]?.id ?? ''))
        setIsLoading(false)
      })
      .catch((loadError: unknown) => {
        console.error('[storing] Laden mislukt.', loadError)
        setError('De gegevens konden niet worden geladen.')
        setIsLoading(false)
      })
  }, [])

  async function handlePhoto(file: File | undefined) {
    if (!file) {
      setPhotoUrl(undefined)
      return
    }
    try {
      setPhotoUrl(await fileToResizedDataUrl(file))
    } catch (photoError) {
      console.error('[storing] Foto verwerken mislukt.', photoError)
      setError('De foto kon niet worden verwerkt.')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return

    setIsSaving(true)
    setError(null)
    try {
      await reportIncident({
        eventId,
        kioskId,
        category,
        description,
        urgency,
        photoUrl,
        reportedById: profile.id,
      })
      router.push('/incidents')
    } catch (submitError) {
      console.error('[storing] Melden mislukt.', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Melden is mislukt.')
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Storing melden" backHref="/incidents" />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  const selectedKiosk = kiosks.find((k) => k.id === kioskId)

  return (
    <>
      <AppHeader title="Storing melden" backHref="/incidents" />
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {selectedKiosk && (
          <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
            <p className="text-xs text-gray-600">Kiosk</p>
            <p className="text-3xl font-black text-arena-red">{selectedKiosk.number}</p>
          </div>
        )}

        <Select
          label="Evenement"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          options={events.map((event) => ({ value: event.id, label: event.name }))}
        />

        <Select
          label="Kiosk"
          value={kioskId}
          onChange={(e) => setKioskId(e.target.value)}
          options={[
            { value: '', label: 'Kies een kiosk…' },
            ...kiosks.map((kiosk) => ({ value: kiosk.id, label: `Kiosk ${kiosk.number}` })),
          ]}
        />

        <Select
          label="Categorie"
          value={category}
          onChange={(e) => setCategory(e.target.value as IncidentCategory)}
          options={Object.values(IncidentCategory).map((value) => ({
            value,
            label: CATEGORY_LABEL[value],
          }))}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">Urgentie</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(IncidentUrgency).map((value) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium ${
                  urgency === value
                    ? 'border-arena-red bg-red-50 text-arena-red'
                    : 'border-gray-300 bg-white text-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="urgency"
                  value={value}
                  checked={urgency === value}
                  onChange={() => setUrgency(value)}
                  className="sr-only"
                />
                {URGENCY_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
            Omschrijving
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Bijv. tap 2 geeft alleen schuim"
            className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
          />
        </div>

        <div>
          <label htmlFor="photo" className="mb-1 block text-sm font-medium text-gray-700">
            Foto (optioneel)
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void handlePhoto(e.target.files?.[0])}
            className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900"
          />
          {photoUrl && (
            // Data-URL uit de camera van de gebruiker; next/image voegt hier niets toe.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Gekozen foto van de storing"
              className="mt-2 max-h-48 rounded-xl object-contain"
            />
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSaving || !kioskId || !eventId || description.trim() === ''}
        >
          {isSaving ? 'Bezig…' : 'Storing melden'}
        </Button>
      </form>
    </>
  )
}
