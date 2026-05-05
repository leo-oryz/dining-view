'use client'

import { useEffect, useState } from 'react'
import { Music2, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

interface SettingsResponse {
  has_token: boolean
  token_last4: string | null
  env_fallback: boolean
}

export default function TikTokSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<SettingsResponse | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/settings/tiktok')
      .then((r) => r.json())
      .then((json) => json.success && setInfo(json.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function refresh() {
    const res = await fetch('/api/settings/tiktok').then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings/tiktok', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ text: 'Saved TikTok access token', type: 'success' })
        setAccessToken('')
        await refresh()
      } else {
        setMsg({ text: `Save failed: ${json.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: 'Save failed', type: 'error' })
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/tiktok/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken || undefined }),
      })
      const json = await res.json()
      const detail = json.data?.detail ?? json.error ?? 'unknown'
      setMsg({ text: detail, type: json.success && json.data?.success ? 'success' : 'error' })
    } catch (err) {
      setMsg({ text: `Connection failed: ${err instanceof Error ? err.message : 'unknown'}`, type: 'error' })
    }
    setTesting(false)
  }

  async function handleSyncNow() {
    setSyncing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/sync/social', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const summary = (json.data?.results ?? [])
          .filter((r: { platform: string }) => r.platform === 'tiktok')
          .map((r: { store: string; daily?: number; posts?: number; skipped?: boolean; error?: string }) =>
            r.error
              ? `${r.store}: error`
              : r.skipped
                ? `${r.store}: skipped`
                : `${r.store}: ${r.daily ?? 0}d / ${r.posts ?? 0}v`,
          )
          .join(' · ')
        setMsg({ text: `Sync complete. ${summary || 'Nothing to sync.'}`, type: 'success' })
      } else {
        setMsg({ text: `Sync failed: ${json.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: 'Sync failed', type: 'error' })
    }
    setSyncing(false)
  }

  const hasCredentials = info?.has_token || info?.env_fallback

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 size={16} className="text-slate-700" />
          <h4 className="text-sm font-semibold text-slate-900">TikTok</h4>
          {hasCredentials ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
              <CheckCircle2 size={12} /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full">
              <Clock size={12} /> Pending approval
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing || !hasCredentials}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-500 inline-flex items-start gap-1">
          {!hasCredentials && <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />}
          <span>
            TikTok for Business API access requires developer approval. Once approved, paste the
            access token below.
          </span>
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Access Token
                {info?.has_token && info.token_last4 && (
                  <span className="ml-2 text-xs text-slate-400">(current: ••••{info.token_last4})</span>
                )}
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={info?.has_token ? 'Leave blank to keep current' : 'TikTok access token'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </>
        )}

        {msg && (
          <div
            className={`text-sm px-3 py-2 rounded-lg ${
              msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
