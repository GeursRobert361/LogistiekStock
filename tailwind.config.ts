import type { Config } from 'tailwindcss'

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
        arena: {
          red: '#E8000D',
          dark: '#1A1A1A',
          gray: '#6B6B6B',
        },
      },
      fontSize: {
        // Larger touch targets for mobile
        'touch-base': ['1rem', { lineHeight: '1.5rem' }],
        'touch-lg': ['1.125rem', { lineHeight: '1.75rem' }],
      },
    },
  },
  plugins: [],
}

export default config
