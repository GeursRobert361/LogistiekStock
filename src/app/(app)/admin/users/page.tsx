'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import type { Profile } from '@/types'
import { UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.PLANNER]: 'Planner',
  [UserRole.TELLER]: 'Teller',
  [UserRole.VULLER]: 'Vuller',
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    repositories
      .auth()
      .listProfiles()
      .then((list) => {
        setProfiles(list)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        console.error('[beheer] Gebruikers laden mislukt.', error)
        setIsLoading(false)
      })
  }, [])

  return (
    <>
      <AppHeader title="Gebruikers" backHref="/dashboard" />
      <div className="space-y-2 p-4">
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : profiles.length === 0 ? (
          <EmptyState title="Geen gebruikers" icon="👥" />
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="flex items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{profile.displayName}</p>
                  <p className="truncate text-sm text-gray-600">{profile.email}</p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                  {profile.roles.map((role) => (
                    <Badge key={role} variant={role === UserRole.ADMIN ? 'arena' : 'default'}>
                      {ROLE_LABEL[role] ?? role}
                    </Badge>
                  ))}
                  {!profile.isActive && <Badge variant="default">Inactief</Badge>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  )
}
