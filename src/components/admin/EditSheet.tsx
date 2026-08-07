'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

interface EditSheetProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  onSubmit: () => Promise<void>
  submitLabel?: string
  /** Extra actie onderaan, bijvoorbeeld uitschakelen. */
  secondaryAction?: { label: string; onClick: () => Promise<void> }
}

/**
 * Klein bewerkformulier in een dialoog.
 *
 * Voor stamdata met een handvol velden is een aparte pagina overdreven; dit
 * houdt de lijst zichtbaar terwijl je één regel aanpast.
 */
export function EditSheet({
  open,
  title,
  children,
  onClose,
  onSubmit,
  submitLabel = 'Opslaan',
  secondaryAction,
}: EditSheetProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await onSubmit()
    } catch (submitError) {
      console.error('[beheer] Opslaan mislukt.', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Opslaan is mislukt.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSecondary() {
    if (!secondaryAction) return
    setIsSaving(true)
    setError(null)
    try {
      await secondaryAction.onClick()
    } catch (actionError) {
      console.error('[beheer] Actie mislukt.', actionError)
      setError(actionError instanceof Error ? actionError.message : 'Actie is mislukt.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {children}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="md" className="flex-1" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" size="md" className="flex-1" disabled={isSaving}>
            {isSaving ? 'Bezig…' : submitLabel}
          </Button>
        </div>

        {secondaryAction && (
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            disabled={isSaving}
            onClick={() => void handleSecondary()}
          >
            {secondaryAction.label}
          </Button>
        )}
      </form>
    </Dialog>
  )
}

/** Schakelaar met een groot raakvlak, zoals in het productformulier. */
export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-gray-300 bg-white px-3">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-arena-red"
      />
    </label>
  )
}
