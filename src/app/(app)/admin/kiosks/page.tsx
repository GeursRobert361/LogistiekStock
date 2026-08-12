'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { kioskLabel, kioskTitle } from '@/lib/kiosk'
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
import { DrinkStorageType, DRINK_STORAGE_LABEL } from '@/types'

interface KioskDraft {
  ringId: string
  number: string
  name: string
  sortOrder: string
  location: string
  notes: string
  isActive: boolean
  label: string
  drinkStorageType: DrinkStorageType
  drinkSourceKioskId: string
}

function toDraft(kiosk: Kiosk | undefined, fallbackRingId: string): KioskDraft {
  return {
    ringId: kiosk?.ringId ?? fallbackRingId,
    number: kiosk ? String(kiosk.number) : '',
    label: kiosk?.label ?? '',
    name: kiosk?.name ?? '',
    sortOrder: String(kiosk?.sortOrder ?? 0),
    location: kiosk?.location ?? '',
    notes: kiosk?.notes ?? '',
    isActive: kiosk?.isActive ?? true,
    drinkStorageType: kiosk?.drinkStorageType ?? DrinkStorageType.NONE,
    drinkSourceKioskId: kiosk?.drinkSourceKioskId ?? '',
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
      // Leeg meesturen, niet weglaten: anders is een opschrift niet te wissen.
      label: draft.label.trim(),
      name: draft.name.trim() || undefined,
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      location: draft.location.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      isActive: draft.isActive,
      drinkStorageType: draft.drinkStorageType,
      // Leeg blijft leeg: een satelliet zonder vastgestelde bronkiosk hoort
      // NULL te zijn, niet een lege tekst.
      drinkSourceKioskId: draft.drinkSourceKioskId || null,
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
                      className={`font-bold ${
                        kioskLabel(kiosk).length > 4 ? 'text-lg' : 'text-2xl'
                      } ${kiosk.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}
                    >
                      {kioskLabel(kiosk)}
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
        title={editing === 'new' || editing === null ? 'Nieuwe kiosk' : kioskTitle(editing)}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      >
        <Select
          label="Ring"
          value={draft.ringId}
          onChange={(e) => setDraft({ ...draft, ringId: e.target.value })}
          options={rings.map((ring) => ({ value: ring.id, label: ring.name }))}
        />
        <Input
          label="Opschrift"
          placeholder={draft.number || 'Bijv. 120 Cubes'}
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        />
        <p className="-mt-2 text-xs text-gray-600">
          Hoe dit telpunt heet op de vloer. Dit staat op het bord en in alle lijsten. Leeg laten
          toont het nummer.
        </p>

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
        <p className="-mt-2 text-xs text-gray-600">
          Het nummer is intern: het koppelt tellijsten en importbestanden en moet uniek zijn binnen
          de ring. Wie een opschrift heeft, ziet dit nummer verder nergens terug.
        </p>
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

        <Select
          label="Drankopslag"
          value={draft.drinkStorageType}
          onChange={(e) =>
            setDraft({ ...draft, drinkStorageType: e.target.value as DrinkStorageType })
          }
          options={Object.values(DrinkStorageType).map((type) => ({
            value: type,
            label: DRINK_STORAGE_LABEL[type],
          }))}
        />
        <p className="text-xs text-gray-600">
          Een satelliet verkoopt drank maar heeft geen koeling: die haalt tijdens het evenement bij
          uit een grote kiosk. Dranktekorten daar gaan niet naar het magazijn. Al het andere —
          bekers, chips, post-mix, koffie — wordt gewoon aangevuld.
        </p>

        {draft.drinkStorageType === DrinkStorageType.SATELLITE && (
          <>
            <Select
              label="Bronkiosk"
              value={draft.drinkSourceKioskId}
              onChange={(e) => setDraft({ ...draft, drinkSourceKioskId: e.target.value })}
              options={[
                { value: '', label: 'Nog niet vastgesteld' },
                ...kiosks
                  .filter((kiosk) => kiosk.drinkStorageType === DrinkStorageType.LARGE_COOLER)
                  .map((kiosk) => ({ value: kiosk.id, label: kioskTitle(kiosk) })),
              ]}
            />
            <p className="text-xs text-gray-600">
              Uit welke grote koeling deze satelliet zijn drank haalt. Mag leeg blijven — er gebeurt
              voorlopig nog niets mee.
            </p>
          </>
        )}
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
