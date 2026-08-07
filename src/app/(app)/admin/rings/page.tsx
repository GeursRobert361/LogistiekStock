'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EditSheet, ToggleField } from '@/components/admin/EditSheet'
import { repositories } from '@/repositories'
import type { Ring } from '@/types'

interface RingDraft {
  name: string
  description: string
  sortOrder: string
  isActive: boolean
}

function toDraft(ring?: Ring): RingDraft {
  return {
    name: ring?.name ?? '',
    description: ring?.description ?? '',
    sortOrder: String(ring?.sortOrder ?? 0),
    isActive: ring?.isActive ?? true,
  }
}

export default function AdminRingsPage() {
  const [rings, setRings] = useState<Ring[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Ring | 'new' | null>(null)
  const [draft, setDraft] = useState<RingDraft>(toDraft())

  const load = useCallback(async () => {
    setRings(await repositories.kiosk().getRings({ includeInactive: true }))
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

  async function handleSave() {
    if (!draft.name.trim()) throw new Error('Geef de ring een naam.')

    const values = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      isActive: draft.isActive,
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
        <ToggleField
          label="Actief"
          checked={draft.isActive}
          onChange={(checked) => setDraft({ ...draft, isActive: checked })}
        />
      </EditSheet>
    </>
  )
}
