'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EditSheet, ToggleField } from '@/components/admin/EditSheet'
import { repositories } from '@/repositories'
import type { Kiosk, Ring } from '@/types'

interface KioskDraft {
  ringId: string
  number: string
  name: string
  sortOrder: string
  location: string
  notes: string
  isActive: boolean
}

function toDraft(kiosk: Kiosk | undefined, fallbackRingId: string): KioskDraft {
  return {
    ringId: kiosk?.ringId ?? fallbackRingId,
    number: kiosk ? String(kiosk.number) : '',
    name: kiosk?.name ?? '',
    sortOrder: String(kiosk?.sortOrder ?? 0),
    location: kiosk?.location ?? '',
    notes: kiosk?.notes ?? '',
    isActive: kiosk?.isActive ?? true,
  }
}

export default function AdminKiosksPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [rings, setRings] = useState<Ring[]>([])
  const [activeRingId, setActiveRingId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Kiosk | 'new' | null>(null)
  const [draft, setDraft] = useState<KioskDraft>(toDraft(undefined, ''))

  const load = useCallback(async () => {
    const [ringList, kioskList] = await Promise.all([
      repositories.kiosk().getRings({ includeInactive: true }),
      repositories.kiosk().getKiosks(undefined, { includeInactive: true }),
    ])
    setRings(ringList)
    setKiosks(kioskList)
    setActiveRingId((current) =>
      ringList.some((ring) => ring.id === current) ? current : (ringList[0]?.id ?? '')
    )
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[beheer] Kiosken laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  const visible = useMemo(
    () =>
      kiosks
        .filter((kiosk) => kiosk.ringId === activeRingId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [kiosks, activeRingId]
  )

  function openEditor(kiosk: Kiosk | 'new') {
    if (kiosk === 'new') {
      // Nieuwe kiosk sluit standaard achteraan aan in de ring.
      const highest = visible.reduce(
        (max, current) => ({
          number: Math.max(max.number, current.number),
          sortOrder: Math.max(max.sortOrder, current.sortOrder),
        }),
        { number: 100, sortOrder: 0 }
      )
      setDraft({
        ...toDraft(undefined, activeRingId),
        number: String(highest.number + 1),
        sortOrder: String(highest.sortOrder + 1),
      })
    } else {
      setDraft(toDraft(kiosk, activeRingId))
    }
    setEditing(kiosk)
  }

  async function handleSave() {
    const number = Number.parseInt(draft.number, 10)
    if (!Number.isFinite(number) || number <= 0) {
      throw new Error('Vul een geldig kiosknummer in.')
    }

    const duplicate = kiosks.find(
      (kiosk) =>
        kiosk.ringId === draft.ringId &&
        kiosk.number === number &&
        (editing === 'new' || kiosk.id !== editing?.id)
    )
    if (duplicate) {
      throw new Error(`Kiosk ${number} bestaat al in deze ring.`)
    }

    const values = {
      ringId: draft.ringId,
      number,
      name: draft.name.trim() || undefined,
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      location: draft.location.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      isActive: draft.isActive,
    }

    if (editing === 'new') {
      await repositories.kiosk().createKiosk(values)
    } else if (editing) {
      await repositories.kiosk().updateKiosk(editing.id, values)
    }

    setEditing(null)
    await load()
  }

  return (
    <>
      <AppHeader
        title="Kiosken"
        backHref="/dashboard"
        actions={
          <Button size="sm" disabled={!activeRingId} onClick={() => openEditor('new')}>
            + Nieuw
          </Button>
        }
      />
      <div className="p-4">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {rings.map((ring) => (
            <button
              key={ring.id}
              type="button"
              onClick={() => setActiveRingId(ring.id)}
              className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-medium ${
                activeRingId === ring.id
                  ? 'bg-arena-red text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {ring.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : visible.length === 0 ? (
          <EmptyState title="Geen kiosken in deze ring" icon="🏪" />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {visible.map((kiosk) => (
              <button key={kiosk.id} type="button" onClick={() => openEditor(kiosk)}>
                <Card className="active:bg-gray-100">
                  <CardContent className="flex min-h-20 flex-col items-center justify-center py-3 text-center">
                    <p
                      className={`text-2xl font-bold ${
                        kiosk.isActive ? 'text-gray-900' : 'text-gray-400 line-through'
                      }`}
                    >
                      {kiosk.number}
                    </p>
                    {kiosk.name && (
                      <p className="mt-0.5 w-full truncate text-[11px] text-gray-600">
                        {kiosk.name}
                      </p>
                    )}
                    {!kiosk.isActive && (
                      <Badge variant="default" className="mt-1">
                        Uit
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <EditSheet
        open={editing !== null}
        title={editing === 'new' || editing === null ? 'Nieuwe kiosk' : `Kiosk ${editing.number}`}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      >
        <Select
          label="Ring"
          value={draft.ringId}
          onChange={(e) => setDraft({ ...draft, ringId: e.target.value })}
          options={rings.map((ring) => ({ value: ring.id, label: ring.name }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nummer"
            inputMode="numeric"
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: e.target.value })}
          />
          <Input
            label="Volgorde in ring"
            inputMode="numeric"
            value={draft.sortOrder}
            onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
          />
        </div>
        <Input
          label="Naam"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          label="Locatie"
          value={draft.location}
          onChange={(e) => setDraft({ ...draft, location: e.target.value })}
        />
        <Input
          label="Notities"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
        <ToggleField
          label="Actief"
          checked={draft.isActive}
          onChange={(checked) => setDraft({ ...draft, isActive: checked })}
        />
        <p className="text-xs text-gray-600">
          De volgorde in de ring bepaalt de looproute bij tellen en vullen.
        </p>
      </EditSheet>
    </>
  )
}
