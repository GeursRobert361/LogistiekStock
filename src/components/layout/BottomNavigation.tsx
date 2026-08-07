'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import {
  IconAdmin,
  IconCount,
  IconDashboard,
  IconIncident,
  IconRestock,
} from './NavIcons'

interface NavItem {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
  permission?: Permission
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { href: '/events', label: 'Tellen', Icon: IconCount, permission: 'COUNT' },
  { href: '/restock-rounds', label: 'Vullen', Icon: IconRestock, permission: 'EXECUTE_RESTOCK' },
  { href: '/incidents', label: 'Storingen', Icon: IconIncident, permission: 'INCIDENTS' },
  { href: '/admin', label: 'Beheer', Icon: IconAdmin, permission: 'MANAGE_STANDARDS' },
]

export function BottomNavigation() {
  const pathname = usePathname()
  const { hasAnyRole } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasAnyRole([...PERMISSIONS[item.permission]])
  )

  return (
    <nav aria-label="Hoofdnavigatie" className="border-t border-concrete-line bg-plate pb-safe">
      <ul className="flex">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 pb-1.5 pt-1.5',
                  // Actief blijkt uit de streep én uit de kleur — kleur alleen
                  // is geen betrouwbaar signaal.
                  isActive
                    ? 'border-arena-red text-ink'
                    : 'border-transparent text-ink-muted'
                )}
              >
                <item.Icon className="h-6 w-6" />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
