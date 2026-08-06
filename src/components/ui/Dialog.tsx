'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'fixed inset-0 z-50 mx-auto mt-[10vh] w-full max-w-md rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/50',
        className
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Bevestigen',
  cancelLabel = 'Annuleren',
  isDestructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-gray-600">{message}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="md" onClick={onClose} className="flex-1">
          {cancelLabel}
        </Button>
        <Button
          variant={isDestructive ? 'destructive' : 'primary'}
          size="md"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Bezig...' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
