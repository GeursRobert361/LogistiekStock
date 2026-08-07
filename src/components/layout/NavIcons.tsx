/**
 * Navigatie-iconen.
 *
 * Emoji renderen per apparaat anders en zien er speels uit; dit is
 * gereedschap voor de werkvloer. Deze vormen komen uit de app zelf: een ring
 * met kiosken, een klembord, een pallet, een waarschuwing, een instelling.
 */
interface IconProps {
  className?: string
}

const base = 'h-6 w-6'

export function IconDashboard({ className = base }: IconProps) {
  // De ring met kiosken erop — de plattegrond waar alles om draait.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="4.5" r="1.8" fill="currentColor" />
      <circle cx="19.5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19.5" r="1.8" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.8" fill="currentColor" />
    </svg>
  )
}

export function IconCount({ className = base }: IconProps) {
  // Turven: hoe er op de vloer geteld wordt.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 5v14M9.5 5v14M14 5v14M18.5 5v14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M3.5 17.5L20 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconRestock({ className = base }: IconProps) {
  // Pallet met lading.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 8.5h12" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 17h18M5.5 17v3M18.5 17v3M12 17v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconIncident({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 4.5L21 19.5H3L12 4.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconUsers({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 6.2a3.2 3.2 0 010 6M17.5 15.2c2 .6 3.2 2.2 3.2 4.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconAdmin({ className = base }: IconProps) {
  // Schuifregelaars: instellen, niet een tandwiel.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" />
      <circle cx="15" cy="12" r="2.2" fill="currentColor" />
      <circle cx="8" cy="17" r="2.2" fill="currentColor" />
    </svg>
  )
}
