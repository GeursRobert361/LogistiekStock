'use client'

import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { PERMISSIONS, type Permission } from '@/lib/permissions'

interface AdminLink {
  href: string
  label: string
  description: string
  permission: Permission
}

/**
 * Overzicht van alles wat te beheren valt.
 *
 * Zonder deze pagina waren ringen, categorieën, import en instellingen alleen
 * via de adresbalk te bereiken — gebouwd maar onvindbaar.
 */
const ADMIN_LINKS: AdminLink[] = [
  {
    href: '/admin/agenda',
    label: 'Agenda',
    description: 'De kalender van het seizoen; hieruit kies je bij een nieuw evenement',
    permission: 'MANAGE_EVENTS',
  },
  {
    href: '/admin/standards',
    label: 'Voorraadnormen',
    description: 'Hoeveel er van elk product in elke kiosk hoort te staan',
    permission: 'MANAGE_STANDARDS',
  },
  {
    href: '/admin/import',
    label: 'Normen importeren',
    description: 'Voorraadnormen uit een CSV-bestand, met voorbeeld vooraf',
    permission: 'MANAGE_STANDARDS',
  },
  {
    href: '/admin/products',
    label: 'Producten',
    description: 'Namen, eenheden, invoerstappen en hoe ze gevuld worden',
    permission: 'MANAGE_MASTER_DATA',
  },
  {
    href: '/admin/categories',
    label: 'Categorieën',
    description: 'Groepen waarin producten tijdens het tellen verschijnen',
    permission: 'MANAGE_MASTER_DATA',
  },
  {
    href: '/admin/rings',
    label: 'Ringen',
    description: 'Startkiosk voor tellen en vullen, en de volgorde van de ringen',
    permission: 'MANAGE_MASTER_DATA',
  },
  {
    href: '/admin/kiosks',
    label: 'Kiosken',
    description: 'Nummers, namen en de looproute binnen een ring',
    permission: 'MANAGE_MASTER_DATA',
  },
  {
    href: '/admin/users',
    label: 'Gebruikers',
    description: 'Wie er toegang heeft en met welke rol',
    permission: 'MANAGE_MASTER_DATA',
  },
  {
    href: '/admin/settings',
    label: 'Instellingen',
    description: 'App-modus en onderhoud',
    permission: 'MANAGE_MASTER_DATA',
  },
]

export default function AdminIndexPage() {
  const { hasAnyRole } = useAuth()

  const visible = ADMIN_LINKS.filter((link) => hasAnyRole([...PERMISSIONS[link.permission]]))

  return (
    <>
      <AppHeader title="Beheer" backHref="/dashboard" />
      <div className="space-y-2 p-4">
        {visible.map((link) => (
          <Link key={link.href} href={link.href} className="block">
            <Card className="active:bg-concrete-light">
              <CardContent className="flex min-h-16 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{link.label}</p>
                  <p className="text-sm text-ink-muted">{link.description}</p>
                </div>
                <span aria-hidden="true" className="flex-shrink-0 text-ink-faint">
                  ›
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
