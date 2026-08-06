import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function RestockStopPage() {
  return (
    <>
      <AppHeader title="Aflevering" backHref="/restock-rounds" />
      <div className="p-4">
        <EmptyState title="Afleverscherm" description="Afleveringen per kiosk worden hier geregistreerd." icon="🚚" />
      </div>
    </>
  )
}
