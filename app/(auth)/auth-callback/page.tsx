'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')

      // Also check query string for type (from redirectTo)
      const query = new URLSearchParams(window.location.search)
      const queryType = query.get('type')
      const callbackType = type || queryType

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (!sessionError) {
          if (callbackType === 'invite' || callbackType === 'recovery') {
            router.push('/set-password')
          } else {
            router.push('/dashboard')
          }
          return
        }

        setError(sessionError.message)
        return
      }

      // No tokens in hash — redirect to login
      setError('驗證失敗，請重新操作')
      setTimeout(() => router.push('/login?error=auth_failed'), 2000)
    }

    handleCallback()
  }, [router, supabase.auth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">FnB Pulse</h1>
          {error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : (
            <p className="text-slate-500 text-sm">驗證中，請稍候...</p>
          )}
        </div>
      </div>
    </div>
  )
}
