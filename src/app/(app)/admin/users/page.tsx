'use client'

import { useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { demoProfiles } from '@/lib/seed/demoData'
import type { Profile } from '@/types'
import { UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.PLANNER]: 'Planner',
  [UserRole.TELLER]: 'Teller',
  [UserRole.VULLER]: 'Vuller',
}

export default function AdminUsersPage() {
  const [profiles] = useState<Profile[]>(demoProfiles)

  return (
    <>
      <AppHeader title="Gebruikers" backHref="/dashboard" />
      <div className="space-y-2 p-4">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-gray-900">{profile.displayName}</p>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {profile.roles.map((role) => (
                  <Badge key={role} variant={role === UserRole.ADMIN ? 'arena' : 'default'}>
                    {ROLE_LABEL[role as UserRole] ?? role}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
