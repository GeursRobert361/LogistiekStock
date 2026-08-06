'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: string
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/events', label: 'Tellen', icon: '📋', roles: [UserRole.TELLER, UserRole.PLANNER, UserRole.ADMIN] },
  { href: '/restock-rounds', label: 'Vullen', icon: '📦', roles: [UserRole.VULLER, UserRole.PLANNER, UserRole.ADMIN] },
  { href: '/incidents', label: 'Storingen', icon: '⚠️' },
  { href: '/admin/products', label: 'Beheer', icon: '⚙️', roles: [UserRole.ADMIN, UserRole.PLANNER] },
]

export function BottomNavigation() {
  const pathname = usePathname()
  const { hasRole } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true
    return item.roles.some((role) => hasRole(role))
  })

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white pb-safe"
    >
      <ul className="flex">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2',
                  isActive ? 'text-arena-red' : 'text-gray-500'
                )}
              >
                <span className="text-xl" aria-hidden="true">{item.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
