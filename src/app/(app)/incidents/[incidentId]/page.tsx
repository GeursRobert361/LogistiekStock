import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function IncidentDetailPage() {
  return (
    <>
      <AppHeader title="Storing" backHref="/incidents" />
      <div className="p-4">
        <EmptyState title="Storingsdetail" description="Detail van de storing." icon="⚠️" />
      </div>
    </>
  )
}
