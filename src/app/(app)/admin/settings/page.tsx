import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function AdminSettingsPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_APP_MODE === 'demo'
  return (
    <>
      <AppHeader title="Instellingen" backHref="/dashboard" />
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>App-modus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Modus:{' '}
              <strong>{isDemoMode ? 'Demo (lokaal, geen database)' : 'Productie (Supabase)'}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
