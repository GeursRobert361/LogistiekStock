'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

interface AppHeaderProps {
  title?: string
  backHref?: string
  actions?: React.ReactNode
}

export function AppHeader({ title, backHref, actions }: AppHeaderProps) {
  const { profile, logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-concrete-line bg-plate">
      <div className="flex h-14 items-center gap-3 px-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Terug"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted active:bg-concrete-light"
          >
            ←
          </Link>
        )}

        <div className="flex-1 overflow-hidden">
          {title ? (
            <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
          ) : (
            <span className="text-base font-bold tracking-tight text-ink">
              Logistiek<span className="text-arena-red">Stock</span>
            </span>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {profile && (
          <button
            type="button"
            onClick={handleLogout}
            aria-label={`Uitloggen (${profile.displayName})`}
            title={`Uitloggen (${profile.displayName})`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-arena-red text-sm font-bold text-white"
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </button>
        )}
      </div>
    </header>
  )
}
