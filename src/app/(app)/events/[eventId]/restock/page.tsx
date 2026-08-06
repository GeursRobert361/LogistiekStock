import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function RestockPage() {
  return (
    <>
      <AppHeader title="Vulplanning" backHref="/events" />
      <div className="p-4">
        <EmptyState
          title="Vulplanning"
          description="Na het goedkeuren van de telling worden hier de vulrondes gepland."
          icon="📦"
        />
      </div>
    </>
  )
}
