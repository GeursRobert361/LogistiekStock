'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EditSheet } from '@/components/admin/EditSheet'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { repositories } from '@/repositories'
import { EVENT_TYPE_LABEL } from '@/lib/eventLabels'
import { formatDate } from '@/lib/utils'
import { EventType } from '@/types'
import type { AgendaEntry } from '@/types'

interface AgendaDraft {
  name: string
  date: string
  eventType: EventType
  notes: string
}

function toDraft(entry?: AgendaEntry): AgendaDraft {
  return {
    name: entry?.name ?? '',
    date: entry?.date ?? '',
    eventType: entry?.eventType ?? EventType.VOETBAL,
    notes: entry?.notes ?? '',
  }
}

/** Vandaag als yyyy-mm-dd, zodat verleden en toekomst te scheiden zijn. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminAgendaPage() {
  const [entries, setEntries] = useState<AgendaEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<AgendaEntry | 'new' | null>(null)
  const [draft, setDraft] = useState<AgendaDraft>(toDraft())
  const [deleting, setDeleting] = useState<AgendaEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setEntries(await repositories.event().getAgenda())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[agenda] Laden mislukt.', loadError)
      setError('De agenda kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  function openEditor(entry: AgendaEntry | 'new') {
    setDraft(toDraft(entry === 'new' ? undefined : entry))
    setEditing(entry)
  }

  async function handleSave() {
    if (!draft.name.trim()) throw new Error('Geef het evenement een naam.')
    if (!draft.date) throw new Error('Kies een datum.')

    await repositories.event().upsertAgendaEntry({
      id: editing === 'new' || editing === null ? undefined : editing.id,
      name: draft.name.trim(),
      date: draft.date,
      eventType: draft.eventType,
      notes: draft.notes.trim() || undefined,
    })

    setEditing(null)
    await load()
  }

  async function handleDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await repositories.event().deleteAgendaEntry(target.id)
      await load()
    } catch (deleteError) {
      console.error('[agenda] Verwijderen mislukt.', deleteError)
      setError('De regel kon niet worden verwijderd.')
    }
  }

  const now = today()
  const upcoming = entries.filter((entry) => entry.date >= now)
  const past = entries.filter((entry) => entry.date < now).reverse()

  return (
    <>
      <AppHeader
        title="Agenda"
        backHref="/admin"
        actions={
          <Button size="sm" onClick={() => openEditor('new')}>
            + Nieuw
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <p className="text-sm text-gray-600">
          Zet hier de kalender van het seizoen neer. Bij het aanmaken van een evenement kies je
          hieruit, zodat naam en datum niet elke keer overgetypt hoeven te worden.
        </p>

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nog niets in de agenda"
            description="Voeg de wedstrijden en concerten toe die eraan komen."
            icon="📅"
          />
        ) : (
          <>
            <AgendaSection
              title="Komt eraan"
              entries={upcoming}
              onEdit={openEditor}
              emptyText="Er staat niets meer op de kalender."
            />
            {past.length > 0 && (
              <AgendaSection title="Geweest" entries={past} onEdit={openEditor} isPast />
            )}
          </>
        )}
      </div>

      <EditSheet
        open={editing !== null}
        title={editing === 'new' || editing === null ? 'Nieuw in de agenda' : editing.name}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      >
        <Input
          label="Naam"
          placeholder="Bijv. Ajax – PSV"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          label="Datum"
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
        <Select
          label="Soort"
          value={draft.eventType}
          onChange={(e) => setDraft({ ...draft, eventType: e.target.value as EventType })}
          options={Object.values(EventType).map((value) => ({
            value,
            label: EVENT_TYPE_LABEL[value],
          }))}
        />
        <Input
          label="Notitie (optioneel)"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />

        {editing !== 'new' && editing !== null && (
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full border-red-300 text-red-700"
            onClick={() => {
              const target = editing
              setEditing(null)
              setDeleting(target)
            }}
          >
            Uit de agenda halen
          </Button>
        )}
      </EditSheet>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        isDestructive
        title="Uit de agenda halen"
        message={`${deleting?.name ?? ''} verdwijnt uit de agenda. Een evenement dat er al mee is aangemaakt blijft gewoon bestaan.`}
        confirmLabel="Verwijderen"
        cancelLabel="Terug"
      />
    </>
  )
}

function AgendaSection({
  title,
  entries,
  onEdit,
  emptyText,
  isPast,
}: {
  title: string
  entries: AgendaEntry[]
  onEdit: (entry: AgendaEntry) => void
  emptyText?: string
  isPast?: boolean
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-600">
          {emptyText ?? 'Niets te tonen.'}
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="py-0">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="flex min-h-14 w-full items-center justify-between gap-2 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p
                      className={`truncate font-semibold ${
                        isPast ? 'text-gray-500' : 'text-gray-900'
                      }`}
                    >
                      {entry.name}
                    </p>
                    <p className="text-sm text-gray-600">{formatDate(entry.date)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge variant="default">{EVENT_TYPE_LABEL[entry.eventType]}</Badge>
                    <span aria-hidden="true" className="text-gray-400">
                      ›
                    </span>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
