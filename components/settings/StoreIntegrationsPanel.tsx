'use client'

import { useEffect, useState } from 'react'
import {
  Mail, Camera, Music2, CalendarRange,
  RefreshCw, CheckCircle2, AlertCircle, Clock,
  Megaphone, BarChart3, Search, MessageSquare,
} from 'lucide-react'

interface StoreInfo {
  id: string
  name: string
  tablecheck_shop_id: string | null
}

type Msg = { text: string; type: 'success' | 'error' } | null

function StatusBadge({ ok, pendingLabel }: { ok: boolean; pendingLabel?: string }) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
        <CheckCircle2 size={12} /> Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full">
      {pendingLabel ? <Clock size={12} /> : <AlertCircle size={12} />}
      {pendingLabel ?? 'Not configured'}
    </span>
  )
}

function MessageBox({ msg }: { msg: Msg }) {
  if (!msg) return null
  return (
    <div className={`text-sm px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {msg.text}
    </div>
  )
}

function GHLBlock({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{ has_api_key: boolean; api_key_last4: string | null; env_fallback: boolean } | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/ghl?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => json.success && setInfo(json.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function refresh() {
    const res = await fetch(`/api/settings/ghl?store_id=${storeId}`).then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/ghl', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, api_key: apiKey }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setApiKey(''); await refresh() }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/ghl/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, api_key: apiKey || undefined }),
      })
      const json = await res.json()
      if (json.success && json.data?.success) setMsg({ text: json.data.detail, type: 'success' })
      else setMsg({ text: json.data?.detail || json.error || 'Connection failed', type: 'error' })
    } catch (err) {
      setMsg({ text: `Connection failed: ${err instanceof Error ? err.message : 'unknown'}`, type: 'error' })
    }
    setTesting(false)
  }

  const hasCredentials = info?.has_api_key || info?.env_fallback

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Mail size={14} className="text-blue-500" />
        <h5 className="text-xs font-semibold text-slate-900">GoHighLevel</h5>
        <StatusBadge ok={!!hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Location API Key
                {info?.has_api_key && info.api_key_last4 && (
                  <span className="ml-2 text-xs text-slate-400">(current: ••••{info.api_key_last4})</span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={info?.has_api_key ? 'Leave blank to keep current' : 'GHL Location API key'}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={handleTest} disabled={testing} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 disabled:opacity-50">{testing ? 'Testing…' : 'Test'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function InstagramBlock({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{
    has_ig_token: boolean; ig_token_last4: string | null; ig_user_id: string | null
    has_fb_token: boolean; fb_token_last4: string | null; fb_page_id: string | null
    env_fallback: boolean
  } | null>(null)
  const [igToken, setIgToken] = useState('')
  const [igUserId, setIgUserId] = useState('')
  const [fbToken, setFbToken] = useState('')
  const [fbPageId, setFbPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/instagram?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setInfo(json.data)
          setIgUserId(json.data.ig_user_id ?? '')
          setFbPageId(json.data.fb_page_id ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function refresh() {
    const res = await fetch(`/api/settings/instagram?store_id=${storeId}`).then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/instagram', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          ig_token: igToken || undefined,
          ig_user_id: igUserId,
          fb_token: fbToken || undefined,
          fb_page_id: fbPageId,
        }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setIgToken(''); setFbToken(''); await refresh() }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/instagram/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          ig_token: igToken || undefined, ig_user_id: igUserId || undefined,
          fb_token: fbToken || undefined, fb_page_id: fbPageId || undefined,
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

  const hasCredentials =
    (info?.has_ig_token && info?.ig_user_id) ||
    (info?.has_fb_token && info?.fb_page_id) ||
    info?.env_fallback

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Camera size={14} className="text-pink-500" />
        <h5 className="text-xs font-semibold text-slate-900">Instagram / Facebook</h5>
        <StatusBadge ok={!!hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Facebook Page ID</label>
                <input type="text" value={fbPageId} onChange={(e) => setFbPageId(e.target.value)}
                  placeholder="123456789012345"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Instagram User ID</label>
                <input type="text" value={igUserId} onChange={(e) => setIgUserId(e.target.value)}
                  placeholder="178414123456789"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  FB Page Access Token
                  {info?.has_fb_token && info.fb_token_last4 && (
                    <span className="ml-2 text-xs text-slate-400">(••••{info.fb_token_last4})</span>
                  )}
                </label>
                <input type="password" value={fbToken} onChange={(e) => setFbToken(e.target.value)}
                  placeholder={info?.has_fb_token ? 'Leave blank to keep current' : 'EAAB...'}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  IG Access Token
                  {info?.has_ig_token && info.ig_token_last4 && (
                    <span className="ml-2 text-xs text-slate-400">(••••{info.ig_token_last4})</span>
                  )}
                </label>
                <input type="password" value={igToken} onChange={(e) => setIgToken(e.target.value)}
                  placeholder={info?.has_ig_token ? 'Leave blank to keep current' : 'EAAB... (or reuse FB token)'}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={handleTest} disabled={testing} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 disabled:opacity-50">{testing ? 'Testing…' : 'Test'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function TikTokBlock({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{ has_token: boolean; token_last4: string | null; env_fallback: boolean } | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/tiktok?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => json.success && setInfo(json.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function refresh() {
    const res = await fetch(`/api/settings/tiktok?store_id=${storeId}`).then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/tiktok', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, access_token: accessToken }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setAccessToken(''); await refresh() }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/tiktok/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, access_token: accessToken || undefined }),
      })
      const json = await res.json()
      const detail = json.data?.detail ?? json.error ?? 'unknown'
      setMsg({ text: detail, type: json.success && json.data?.success ? 'success' : 'error' })
    } catch (err) {
      setMsg({ text: `Connection failed: ${err instanceof Error ? err.message : 'unknown'}`, type: 'error' })
    }
    setTesting(false)
  }

  const hasCredentials = info?.has_token || info?.env_fallback

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Music2 size={14} className="text-slate-700" />
        <h5 className="text-xs font-semibold text-slate-900">TikTok</h5>
        <StatusBadge ok={!!hasCredentials} pendingLabel={hasCredentials ? undefined : 'Pending approval'} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              TikTok for Business API access requires developer approval. Once approved, paste the access token below.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Access Token
                {info?.has_token && info.token_last4 && (
                  <span className="ml-2 text-xs text-slate-400">(••••{info.token_last4})</span>
                )}
              </label>
              <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                placeholder={info?.has_token ? 'Leave blank to keep current' : 'TikTok access token'}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={handleTest} disabled={testing} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 disabled:opacity-50">{testing ? 'Testing…' : 'Test'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function MetaAdsBlock({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{ has_access_token: boolean; access_token_last4: string | null; account_id: string | null } | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/meta-ads?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) { setInfo(json.data); setAccountId(json.data.account_id ?? '') }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function refresh() {
    const res = await fetch(`/api/settings/meta-ads?store_id=${storeId}`).then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/meta-ads', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, access_token: accessToken || undefined, account_id: accountId }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setAccessToken(''); await refresh() }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  const hasCredentials = info?.has_access_token && !!info?.account_id

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Megaphone size={14} className="text-blue-600" />
        <h5 className="text-xs font-semibold text-slate-900">Meta Ads</h5>
        <StatusBadge ok={!!hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (<p className="text-xs text-slate-400">Loading…</p>) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Access Token
                {info?.has_access_token && info.access_token_last4 && (
                  <span className="ml-2 text-xs text-slate-400">(••••{info.access_token_last4})</span>
                )}
              </label>
              <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                placeholder={info?.has_access_token ? 'Leave blank to keep current' : 'Meta Ads access token'}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ad Account ID</label>
              <input type="text" value={accountId} onChange={(e) => setAccountId(e.target.value)}
                placeholder="act_xxxxxxxxxx"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function GA4Block({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{ property_id: string | null } | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/ga4?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) { setInfo(json.data); setPropertyId(json.data.property_id ?? '') }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/ga4', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, property_id: propertyId }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setInfo({ property_id: propertyId }) }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  const hasCredentials = !!info?.property_id

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <BarChart3 size={14} className="text-orange-500" />
        <h5 className="text-xs font-semibold text-slate-900">Google Analytics 4</h5>
        <StatusBadge ok={hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (<p className="text-xs text-slate-400">Loading…</p>) : (
          <>
            <p className="text-xs text-slate-500">Service account auth is shared across all brands; only the Property ID is per-store.</p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GA4 Property ID</label>
              <input type="text" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function GSCBlock({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{ site_url: string | null } | null>(null)
  const [siteUrl, setSiteUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/gsc?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) { setInfo(json.data); setSiteUrl(json.data.site_url ?? '') }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/gsc', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, site_url: siteUrl }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setInfo({ site_url: siteUrl }) }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  const hasCredentials = !!info?.site_url

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Search size={14} className="text-green-600" />
        <h5 className="text-xs font-semibold text-slate-900">Google Search Console</h5>
        <StatusBadge ok={hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (<p className="text-xs text-slate-400">Loading…</p>) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Site URL</label>
              <input type="text" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com/ or sc-domain:example.com"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function LineBlock({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<{
    has_channel_access_token: boolean; channel_access_token_last4: string | null
    has_channel_secret: boolean; channel_secret_last4: string | null
  } | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/line?store_id=${storeId}`)
      .then((r) => r.json())
      .then((json) => json.success && setInfo(json.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [storeId])

  async function refresh() {
    const res = await fetch(`/api/settings/line?store_id=${storeId}`).then((r) => r.json())
    if (res.success) setInfo(res.data)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/line', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          channel_access_token: accessToken || undefined,
          channel_secret: secret || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) { setMsg({ text: 'Saved', type: 'success' }); setAccessToken(''); setSecret(''); await refresh() }
      else { setMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setMsg({ text: 'Save failed', type: 'error' }) }
    setSaving(false)
  }

  const hasCredentials = info?.has_channel_access_token

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <MessageSquare size={14} className="text-green-500" />
        <h5 className="text-xs font-semibold text-slate-900">LINE Messaging</h5>
        <StatusBadge ok={!!hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        {loading ? (<p className="text-xs text-slate-400">Loading…</p>) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Channel Access Token
                {info?.has_channel_access_token && info.channel_access_token_last4 && (
                  <span className="ml-2 text-xs text-slate-400">(••••{info.channel_access_token_last4})</span>
                )}
              </label>
              <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                placeholder={info?.has_channel_access_token ? 'Leave blank to keep current' : 'LINE channel access token'}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Channel Secret <span className="text-slate-400">(optional)</span>
                {info?.has_channel_secret && info.channel_secret_last4 && (
                  <span className="ml-2 text-xs text-slate-400">(••••{info.channel_secret_last4})</span>
                )}
              </label>
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
                placeholder={info?.has_channel_secret ? 'Leave blank to keep current' : 'Webhook signature secret'}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
        <MessageBox msg={msg} />
      </div>
    </div>
  )
}

function TableCheckBlock({ store, onSaved }: { store: StoreInfo; onSaved: () => void }) {
  const [shopId, setShopId] = useState(store.tablecheck_shop_id ?? '')
  const [savingShop, setSavingShop] = useState(false)
  const [shopMsg, setShopMsg] = useState<Msg>(null)

  const [loadingApi, setLoadingApi] = useState(true)
  const [apiInfo, setApiInfo] = useState<{ has_api_key: boolean; api_key_last4: string | null } | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [savingApi, setSavingApi] = useState(false)
  const [apiMsg, setApiMsg] = useState<Msg>(null)

  useEffect(() => { setShopId(store.tablecheck_shop_id ?? '') }, [store.tablecheck_shop_id])

  useEffect(() => {
    setLoadingApi(true)
    fetch(`/api/settings/tablecheck-api?store_id=${store.id}`)
      .then((r) => r.json())
      .then((json) => json.success && setApiInfo(json.data))
      .catch(() => {})
      .finally(() => setLoadingApi(false))
  }, [store.id])

  const isShopDirty = shopId.trim() !== (store.tablecheck_shop_id ?? '')

  async function handleSaveShop() {
    setSavingShop(true); setShopMsg(null)
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tablecheck_shop_id: shopId.trim() || null }),
      })
      const json = await res.json()
      if (json.success) { setShopMsg({ text: 'Saved', type: 'success' }); onSaved() }
      else { setShopMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setShopMsg({ text: 'Save failed', type: 'error' }) }
    setSavingShop(false)
  }

  async function refreshApi() {
    const res = await fetch(`/api/settings/tablecheck-api?store_id=${store.id}`).then((r) => r.json())
    if (res.success) setApiInfo(res.data)
  }

  async function handleSaveApi() {
    setSavingApi(true); setApiMsg(null)
    try {
      const res = await fetch('/api/settings/tablecheck-api', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, api_key: apiKey || undefined }),
      })
      const json = await res.json()
      if (json.success) { setApiMsg({ text: 'Saved', type: 'success' }); setApiKey(''); await refreshApi() }
      else { setApiMsg({ text: `Save failed: ${json.error}`, type: 'error' }) }
    } catch { setApiMsg({ text: 'Save failed', type: 'error' }) }
    setSavingApi(false)
  }

  const hasCredentials = !!store.tablecheck_shop_id && !!apiInfo?.has_api_key

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <CalendarRange size={14} className="text-emerald-500" />
        <h5 className="text-xs font-semibold text-slate-900">TableCheck Reservations</h5>
        <StatusBadge ok={hasCredentials} />
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500">
          The shop_id is the slug from your TableCheck account (e.g. <code className="px-1 bg-slate-100 rounded">nom-dining-hcmc</code>) — not a UUID. Auto-syncs every 30 minutes.
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Shop ID</label>
          <input type="text" value={shopId} onChange={(e) => setShopId(e.target.value)}
            placeholder="e.g. nom-dining-hcmc"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSaveShop} disabled={!isShopDirty || savingShop} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40">{savingShop ? 'Saving…' : 'Save shop_id'}</button>
        </div>
        <MessageBox msg={shopMsg} />

        <div className="border-t border-slate-200 pt-3">
          {loadingApi ? (<p className="text-xs text-slate-400">Loading…</p>) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  API Key
                  {apiInfo?.has_api_key && apiInfo.api_key_last4 && (
                    <span className="ml-2 text-xs text-slate-400">(••••{apiInfo.api_key_last4})</span>
                  )}
                </label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiInfo?.has_api_key ? 'Leave blank to keep current' : 'TableCheck API key'}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={handleSaveApi} disabled={savingApi} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">{savingApi ? 'Saving…' : 'Save API key'}</button>
              </div>
              <MessageBox msg={apiMsg} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface SyncSummary {
  text: string
  type: 'success' | 'error'
}

export default function StoreIntegrationsPanel({ store, onSaved }: { store: StoreInfo; onSaved: () => void }) {
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<SyncSummary | null>(null)

  async function runSync(label: string, url: string) {
    setSyncing(label); setSyncMsg(null)
    try {
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json()
      setSyncMsg({
        text: json.success ? `${label}: synced` : `${label} failed: ${json.error}`,
        type: json.success ? 'success' : 'error',
      })
    } catch { setSyncMsg({ text: `${label} failed`, type: 'error' }) }
    setSyncing(null)
  }

  return (
    <div className="border-t border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Sync now</span>
        {[
          { label: 'GoHighLevel', url: '/api/sync/ghl' },
          { label: 'Social', url: '/api/sync/social' },
          { label: 'TableCheck', url: '/api/sync/tablecheck' },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => runSync(s.label, s.url)}
            disabled={syncing === s.label}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing === s.label ? 'animate-spin' : ''} />
            {syncing === s.label ? 'Syncing…' : s.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">Sync runs across all stores; status above reflects credentials saved for this store only.</p>
      <MessageBox msg={syncMsg} />

      <div className="grid grid-cols-1 gap-3">
        <MetaAdsBlock storeId={store.id} />
        <GA4Block storeId={store.id} />
        <GSCBlock storeId={store.id} />
        <LineBlock storeId={store.id} />
        <GHLBlock storeId={store.id} />
        <InstagramBlock storeId={store.id} />
        <TikTokBlock storeId={store.id} />
        <TableCheckBlock store={store} onSaved={onSaved} />
      </div>
    </div>
  )
}
