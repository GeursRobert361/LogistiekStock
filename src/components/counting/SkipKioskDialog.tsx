'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { SKIP_REASONS, OTHER_SKIP_REASON } from '@/lib/reasons'

interface SkipKioskDialogProps {
  open: boolean
  kioskNumber?: number
  onClose: () => void
  onConfirm: (reason: string) => void
}

/**
 * Een kiosk overslaan kan alleen met een reden: zonder reden is later niet meer
 * te achterhalen waarom er geen telling ligt.
 */
export function SkipKioskDialog({
  open,
  kioskNumber,
  onClose,
  onConfirm,
}: SkipKioskDialogProps) {
  const [selected, setSelected] = useState<string>('')
  const [otherText, setOtherText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelected('')
      setOtherText('')
      setError(null)
    }
  }, [open])

  const needsFreeText = selected === OTHER_SKIP_REASON

  function handleConfirm() {
    if (!selected) {
      setError('Kies een reden om deze kiosk over te slaan.')
      return
    }
    if (needsFreeText && otherText.trim() === '') {
      setError('Vul de reden in.')
      return
    }
    onConfirm(needsFreeText ? `${OTHER_SKIP_REASON}: ${otherText.trim()}` : selected)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kioskNumber ? `Kiosk ${kioskNumber} overslaan` : 'Kiosk overslaan'}
    >
      <fieldset className="mb-3">
        <legend className="mb-2 text-sm font-medium text-gray-700">Reden</legend>
        <div className="space-y-2">
          {SKIP_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium ${
                selected === reason
                  ? 'border-arena-red bg-red-50 text-arena-red'
                  : 'border-gray-300 bg-white text-gray-800'
              }`}
            >
              <input
                type="radio"
                name="skip-reason"
                value={reason}
                checked={selected === reason}
                onChange={() => {
                  setSelected(reason)
                  setError(null)
                }}
                className="h-5 w-5 accent-arena-red"
              />
              {reason}
            </label>
          ))}
        </div>
      </fieldset>

      {needsFreeText && (
        <div className="mb-3">
          <label htmlFor="skip-other" className="mb-1 block text-sm font-medium text-gray-700">
            Licht toe
          </label>
          <textarea
            id="skip-other"
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value)
              setError(null)
            }}
            rows={2}
            className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="md" onClick={onClose} className="flex-1">
          Annuleren
        </Button>
        <Button size="md" onClick={handleConfirm} className="flex-1">
          Overslaan
        </Button>
      </div>
    </Dialog>
  )
}
