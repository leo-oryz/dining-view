'use client'

import { useEffect, useState } from 'react'
import { Users, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface SettingsResponse {
  has_api_key: boolean
  api_key_last4: string | null
  company_id: string | null
  env_fallback: boolean
}

export default function BetterHRSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<SettingsResponse | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/settings/betterhr')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setInfo(json.data)
          if (json.data.company_id) setCompanyId(json.data.company_id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings/betterhr', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey || undefined,
          company_id: companyId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ text: 'Saved BetterHR credentials', type: 'success' })
        setApiKey('')
        const refresh = await fetch('/api/settings/betterhr').then((r) => r.json())
        if (refresh.success) setInfo(refresh.data)
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
      const res = await fetch('/api/integrations/betterhr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey || undefined,
          company_id: companyId || undefined,
        }),
      })
      const json = await res.json()
      if (json.success && json.data?.success) {
        setMsg({
          text: `Connection OK — ${json.data.employeeCount} employees visible`,
          type: 'success',
        })
      } else {
        setMsg({
          text: `Connection failed: ${json.error || json.data?.error || 'unknown'}`,
          type: 'error',
        })
      }
    } catch (err) {
      setMsg({
        text: `Connection failed: ${err instanceof Error ? err.message : 'unknown'}`,
        type: 'error',
      })
    }
    setTesting(false)
  }

  async function handleSyncNow() {
    setSyncing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/sync/betterhr', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const summary = (json.data?.results ?? [])
          .map((r: { store: string; employees?: number; skipped?: boolean; error?: string }) =>
            r.error
              ? `${r.store}: error`
              : r.skipped
                ? `${r.store}: skipped`
                : `${r.store}: ${r.employees ?? 0} emp`,
          )
          .join(' · ')
        setMsg({ text: `Sync complete. ${summary || 'No stores synced.'}`, type: 'success' })
      } else {
        setMsg({ text: `Sync failed: ${json.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: 'Sync failed', type: 'error' })
    }
    setSyncing(false)
  }

  const hasCredentials = (info?.has_api_key && info?.company_id) || info?.env_fallback

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-purple-500" />
          <h4 className="text-sm font-semibold text-slate-900">BetterHR</h4>
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-500">
          BetterHR credentials sync employees, attendance, payroll, and leave once per day.
          Saving here applies the same credentials to all active stores.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                API Key
                {info?.has_api_key && info.api_key_last4 && (
                  <span className="ml-2 text-xs text-slate-400">
                    (current: ••••{info.api_key_last4})
                  </span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={info?.has_api_key ? 'Leave blank to keep current' : 'BetterHR API key'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company ID</label>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="BetterHR company ID"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
