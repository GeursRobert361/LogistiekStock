import type { Config } from 'tailwindcss'

/**
 * Kleuren komen uit de omgeving waar de app gebruikt wordt: het serviceniveau
 * van de ArenA. Gestort beton als ondergrond, witte borden erop, en rood dat
 * uitsluitend "hier moet je iets doen" betekent.
 *
 * Vlak wit als achtergrond is hier verkeerd: het geeft glare in de gangen en
 * laat kaarten zweven omdat ze dezelfde kleur hebben als waar ze op liggen.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Ondergrond. Koel grijs met een lichte groenzweem — gestort beton,
        // nadrukkelijk geen crème (te warm) en geen slate (te blauw).
        concrete: {
          DEFAULT: '#E6E9E4',
          light: '#F1F3EF',
          line: '#D2D7CE',
          deep: '#C7CDC2',
        },
        // Bordjes: wit is nu zeldzaam en betekent daardoor "hier staat inhoud".
        plate: '#FFFFFF',
        ink: {
          DEFAULT: '#16181A',
          muted: '#565D63',
          faint: '#8A9196',
        },
        arena: {
          red: '#E8000D',
          press: '#B80009',
          dark: '#1A1A1A',
          gray: '#6B6B6B',
        },
      },
      fontFamily: {
        sans: ['var(--font-plex)', 'system-ui', 'sans-serif'],
        // Smal en met tabelcijfers: voor kiosknummers en aantallen.
        numeric: ['var(--font-plex-condensed)', 'var(--font-plex)', 'sans-serif'],
      },
      fontSize: {
        'touch-base': ['1rem', { lineHeight: '1.5rem' }],
        'touch-lg': ['1.125rem', { lineHeight: '1.75rem' }],
      },
      boxShadow: {
        // Bordjes liggen op het beton in plaats van te zweven.
        plate: '0 1px 0 0 rgba(22, 24, 26, 0.04), 0 1px 3px 0 rgba(22, 24, 26, 0.08)',
        'plate-raised': '0 2px 4px -1px rgba(22, 24, 26, 0.10), 0 4px 12px -2px rgba(22, 24, 26, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
