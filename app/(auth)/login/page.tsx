'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher'

// Only allow same-origin relative paths so ?next= can't be used for open redirect.
function safeNext(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm mx-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">FnB Pulse</h1>
          </div>
        </div>
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { t } = useI18n()
  const nextPath = safeNext(searchParams.get('next'))

  // Handle invite/recovery tokens from URL hash (Supabase implicit flow)
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return

    setTokenLoading(true)
    const type = params.get('type') || new URLSearchParams(window.location.search).get('type')

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message)
          setTokenLoading(false)
          return
        }
        if (type === 'invite' || type === 'recovery') {
          router.push('/set-password')
        } else {
          router.push(nextPath || '/dashboard')
        }
      })
  }, [router, supabase.auth, nextPath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? t('login.invalidCredentials')
        : authError.message)
      setLoading(false)
      return
    }

    router.push(nextPath || '/dashboard')
    router.refresh()
  }

  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm mx-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">FnB Pulse</h1>
            <p className="text-sm text-slate-500">驗證中，請稍候...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">FnB Pulse</h1>
            <p className="text-sm text-slate-500 mt-1">Restaurant Intelligence Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                autoFocus
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  {t('login.password')}
                </label>
                <a href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
                  {t('login.forgotPassword')}
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('login.passwordPlaceholder')}
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <div className="mt-6 flex justify-center">
            <LocaleSwitcher className="text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
