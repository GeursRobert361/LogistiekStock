'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { PERMISSIONS, type Permission } from '@/lib/permissions'

interface NavItem {
  href: string
  label: string
  icon: string
  permission?: Permission
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/events', label: 'Tellen', icon: '📋', permission: 'COUNT' },
  { href: '/restock-rounds', label: 'Vullen', icon: '📦', permission: 'EXECUTE_RESTOCK' },
  { href: '/incidents', label: 'Storingen', icon: '⚠️', permission: 'INCIDENTS' },
  { href: '/admin/products', label: 'Beheer', icon: '⚙️', permission: 'MANAGE_MASTER_DATA' },
]

export function BottomNavigation() {
  const pathname = usePathname()
  const { hasAnyRole } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasAnyRole([...PERMISSIONS[item.permission]])
  )

  return (
    <nav aria-label="Hoofdnavigatie" className="border-t border-gray-100 bg-white pb-safe">
      <ul className="flex">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 py-2',
                  isActive ? 'text-arena-red' : 'text-gray-500'
                )}
              >
                <span className="text-xl" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
