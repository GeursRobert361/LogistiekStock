import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function RestockRoundsPage() {
  return (
    <>
      <AppHeader title="Vulrondes" />
      <div className="p-4">
        <EmptyState
          title="Vulrondes"
          description="Hier worden vulrondes getoond na het goedkeuren van een telling."
          icon="📦"
        />
      </div>
    </>
  )
}
