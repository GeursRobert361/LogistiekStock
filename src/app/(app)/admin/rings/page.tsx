'use client'

import { useCallback, useEffect, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
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

interface RingDraft {
  name: string
  description: string
  sortOrder: string
  isActive: boolean
  countStartKioskId: string
  restockStartKioskId: string
}

function toDraft(ring?: Ring): RingDraft {
  return {
    name: ring?.name ?? '',
    description: ring?.description ?? '',
    sortOrder: String(ring?.sortOrder ?? 0),
    isActive: ring?.isActive ?? true,
    countStartKioskId: ring?.countStartKioskId ?? '',
    restockStartKioskId: ring?.restockStartKioskId ?? '',
  }
}

export default function AdminRingsPage() {
  const [rings, setRings] = useState<Ring[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Ring | 'new' | null>(null)
  const [draft, setDraft] = useState<RingDraft>(toDraft())

  const load = useCallback(async () => {
    const [ringList, kioskList] = await Promise.all([
      repositories.kiosk().getRings({ includeInactive: true }),
      repositories.kiosk().getKiosks(),
    ])
    setRings(ringList)
    setKiosks(kioskList)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[beheer] Ringen laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  function openEditor(ring: Ring | 'new') {
    setDraft(toDraft(ring === 'new' ? undefined : ring))
    setEditing(ring)
  }

  // Alleen kiosken van de ring die bewerkt wordt; een startkiosk uit een
  // andere ring zou de route stuursturen.
  const kioskOptions =
    editing && editing !== 'new'
      ? kiosks
          .filter((kiosk) => kiosk.ringId === editing.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((kiosk) => ({ value: kiosk.id, label: kioskTitle(kiosk) }))
      : []

  async function handleSave() {
    if (!draft.name.trim()) throw new Error('Geef de ring een naam.')

    const values = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      isActive: draft.isActive,
      countStartKioskId: draft.countStartKioskId || undefined,
      restockStartKioskId: draft.restockStartKioskId || undefined,
    }

    if (editing === 'new') {
      await repositories.kiosk().createRing(values)
    } else if (editing) {
      await repositories.kiosk().updateRing(editing.id, values)
    }

    setEditing(null)
    await load()
  }

  return (
    <>
      <AppHeader
        title="Ringen"
        backHref="/dashboard"
        actions={
          <Button size="sm" onClick={() => openEditor('new')}>
            + Nieuw
          </Button>
        }
      />
      <div className="space-y-2 p-4">
        {isLoading ? (
          <ListSkeleton count={2} />
        ) : rings.length === 0 ? (
          <EmptyState title="Geen ringen" icon="🔁" />
        ) : (
          rings.map((ring) => (
            <Card key={ring.id}>
              <CardContent className="py-0">
                <button
                  type="button"
                  onClick={() => openEditor(ring)}
                  className="flex min-h-14 w-full items-center justify-between gap-2 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{ring.name}</p>
                    {ring.description && (
                      <p className="truncate text-sm text-gray-600">{ring.description}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {!ring.isActive && <Badge variant="default">Uit</Badge>}
                    <span aria-hidden="true" className="text-gray-400">
                      ›
                    </span>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <EditSheet
        open={editing !== null}
        title={editing === 'new' ? 'Nieuwe ring' : 'Ring bewerken'}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      >
        <Input
          label="Naam"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          label="Omschrijving"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <Input
          label="Volgorde"
          inputMode="numeric"
          value={draft.sortOrder}
          onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
        />
        <Select
          label="Startkiosk tellen"
          value={draft.countStartKioskId}
          onChange={(e) => setDraft({ ...draft, countStartKioskId: e.target.value })}
          options={[{ value: '', label: 'Eerste kiosk van de ring' }, ...kioskOptions]}
        />
        <Select
          label="Startkiosk vullen"
          value={draft.restockStartKioskId}
          onChange={(e) => setDraft({ ...draft, restockStartKioskId: e.target.value })}
          options={[{ value: '', label: 'Eerste kiosk met vraag' }, ...kioskOptions]}
        />
        <p className="text-xs text-gray-600">
          Tellen en vullen beginnen zelden op dezelfde plek: bij het tellen kom je de lift uit,
          bij het vullen rijd je met een pallet een andere kant op.
        </p>

        <ToggleField
          label="Actief"
          checked={draft.isActive}
          onChange={(checked) => setDraft({ ...draft, isActive: checked })}
        />
      </EditSheet>
    </>
  )
}
