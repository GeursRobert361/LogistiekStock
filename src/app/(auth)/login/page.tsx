'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isDemoMode = process.env.NEXT_PUBLIC_APP_MODE === 'demo'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt')
    } finally {
      setIsLoading(false)
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('demo1234')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-concrete p-4">
      <div className="w-full max-w-sm rounded-2xl border border-concrete-line bg-plate p-8 shadow-plate-raised">
        {/* Logo / titel */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-arena-red">
            <span className="text-2xl font-bold text-white">LS</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">LogistiekStock</h1>
          <p className="mt-1 text-sm text-gray-500">Johan Cruijff ArenA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 bg-white placeholder:text-gray-400 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/20"
              placeholder="naam@voorbeeld.nl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 bg-white placeholder:text-gray-400 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg bg-arena-red px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {isLoading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>

        {isDemoMode && (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Demo-accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['admin@demo.nl', 'Admin'],
                ['planner@demo.nl', 'Planner'],
                ['teller1@demo.nl', 'Teller'],
                ['vuller1@demo.nl', 'Vuller'],
              ].map(([demoEmail, label]) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => fillDemo(demoEmail!)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
