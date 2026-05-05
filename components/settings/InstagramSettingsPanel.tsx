'use client'

import { useEffect, useState } from 'react'
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface SettingsResponse {
  has_ig_token: boolean
  ig_token_last4: string | null
  ig_user_id: string | null
  has_fb_token: boolean
  fb_token_last4: string | null
  fb_page_id: string | null
  env_fallback: boolean
}

export default function InstagramSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<SettingsResponse | null>(null)
  const [igToken, setIgToken] = useState('')
  const [igUserId, setIgUserId] = useState('')
  const [fbToken, setFbToken] = useState('')
  const [fbPageId, setFbPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/settings/instagram')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setInfo(json.data)
          if (json.data.ig_user_id) setIgUserId(json.data.ig_user_id)
          if (json.data.fb_page_id) setFbPageId(json.data.fb_page_id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function refresh() {
    const res = await fetch('/api/settings/instagram').then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings/instagram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ig_token: igToken || undefined,
          ig_user_id: igUserId,
          fb_token: fbToken || undefined,
          fb_page_id: fbPageId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ text: 'Saved Instagram/Facebook credentials', type: 'success' })
        setIgToken('')
        setFbToken('')
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
      const res = await fetch('/api/integrations/instagram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ig_token: igToken || undefined,
          ig_user_id: igUserId || undefined,
          fb_token: fbToken || undefined,
          fb_page_id: fbPageId || undefined,
        }),
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
          .filter((r: { platform: string }) => r.platform === 'instagram' || r.platform === 'facebook')
          .map((r: { store: string; platform: string; daily?: number; posts?: number; skipped?: boolean; error?: string }) =>
            r.error
              ? `${r.store}/${r.platform}: error`
              : r.skipped
                ? `${r.store}/${r.platform}: skipped`
                : `${r.store}/${r.platform}: ${r.daily ?? 0}d / ${r.posts ?? 0}p`,
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

  const hasCredentials =
    (info?.has_ig_token && info?.ig_user_id) ||
    (info?.has_fb_token && info?.fb_page_id) ||
    info?.env_fallback

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-pink-500" />
          <h4 className="text-sm font-semibold text-slate-900">Instagram / Facebook</h4>
          {hasCredentials ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
              <CheckCircle2 size={12} /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full">
              <AlertCircle size={12} /> Not configured
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing || !hasCredentials}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-600 text-white text-xs rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-500">
          Page Access Token (Facebook Graph). Use the same token for Instagram if your account is
          linked to a Facebook Page.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Facebook Page ID
                </label>
                <input
                  type="text"
                  value={fbPageId}
                  onChange={(e) => setFbPageId(e.target.value)}
                  placeholder="123456789012345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instagram User ID
                </label>
                <input
                  type="text"
                  value={igUserId}
                  onChange={(e) => setIgUserId(e.target.value)}
                  placeholder="178414123456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Facebook Page Access Token
                  {info?.has_fb_token && info.fb_token_last4 && (
                    <span className="ml-2 text-xs text-slate-400">(current: ••••{info.fb_token_last4})</span>
                  )}
                </label>
                <input
                  type="password"
                  value={fbToken}
                  onChange={(e) => setFbToken(e.target.value)}
                  placeholder={info?.has_fb_token ? 'Leave blank to keep current' : 'EAAB...'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instagram Access Token
                  {info?.has_ig_token && info.ig_token_last4 && (
                    <span className="ml-2 text-xs text-slate-400">(current: ••••{info.ig_token_last4})</span>
                  )}
                </label>
                <input
                  type="password"
                  value={igToken}
                  onChange={(e) => setIgToken(e.target.value)}
                  placeholder={info?.has_ig_token ? 'Leave blank to keep current' : 'EAAB... (or reuse FB token)'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
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
