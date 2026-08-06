import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function RestockRoundDetailPage() {
  return (
    <>
      <AppHeader title="Vulronde" backHref="/restock-rounds" />
      <div className="p-4">
        <EmptyState title="Vulronde" description="Details van de vulronde worden hier getoond." icon="📦" />
      </div>
    </>
  )
}
