'use client'

import { useEffect, useState, useCallback } from 'react'
import { Brain, RefreshCw, CalendarDays, Plane, Bell, CheckCircle2, AlertCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

interface IntelligenceSettings {
  calendarific: { has_key: boolean; last4: string | null; env_fallback: boolean }
  aviationstack: { has_key: boolean; last4: string | null; env_fallback: boolean }
  monitored_airport: string
}

interface AlertRule {
  alert_type: string
  is_active: boolean
  threshold: number | null
}

interface Holiday {
  country_code: string
  date: string
  name: string
  created_at?: string
}

const COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: 'TW', flag: '🇹🇼', name: 'Taiwan' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: 'HK', flag: '🇭🇰', name: 'Hong Kong' },
  { code: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'PH', flag: '🇵🇭', name: 'Philippines' },
]

const ALERT_TYPES: { type: 'flight_spike' | 'holiday_peak' | 'revenue_drop' | 'no_show_spike' | 'low_covers'; thresholdField?: 'spikeThreshold' | 'revenueDropThreshold' }[] = [
  { type: 'flight_spike', thresholdField: 'spikeThreshold' },
  { type: 'holiday_peak' },
  { type: 'revenue_drop', thresholdField: 'revenueDropThreshold' },
  { type: 'no_show_spike' },
  { type: 'low_covers' },
]

export default function IntelligenceSettingsPanel() {
  const { t } = useI18n()
  const [info, setInfo] = useState<IntelligenceSettings | null>(null)
  const [rules, setRules] = useState<AlertRule[]>([])
  const [holidayLastSynced, setHolidayLastSynced] = useState<string | null>(null)
  const [calendarificKey, setCalendarificKey] = useState('')
  const [aviationstackKey, setAviationstackKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [holidaySync, setHolidaySync] = useState(false)
  const [flightSync, setFlightSync] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [settingsJson, rulesJson, holidayJson] = await Promise.all([
        fetch('/api/settings/intelligence').then((r) => r.json()).catch(() => ({ success: false })),
        fetch('/api/alerts/rules').then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`/api/holidays?country_code=VN&year=${new Date().getFullYear()}`).then((r) => r.json()).catch(() => ({ success: false })),
      ])
      if (settingsJson.success) setInfo(settingsJson.data)
      if (rulesJson.success) setRules(rulesJson.data ?? [])
      if (holidayJson.success && Array.isArray(holidayJson.data) && holidayJson.data.length > 0) {
        const latest = (holidayJson.data as Holiday[]).reduce<string | null>((max, h) => {
          const c = h.created_at ?? null
          if (!c) return max
          if (!max || c > max) return c
          return max
        }, null)
        setHolidayLastSynced(latest)
      } else {
        setHolidayLastSynced(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSaveKeys = async () => {
    if (!calendarificKey && !aviationstackKey) return
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, string> = {}
      if (calendarificKey) body.calendarific_api_key = calendarificKey
      if (aviationstackKey) body.aviationstack_api_key = aviationstackKey
      const res = await fetch('/api/settings/intelligence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ text: 'Saved API keys', type: 'success' })
        setCalendarificKey('')
        setAviationstackKey('')
        await loadAll()
      } else {
        setMsg({ text: `Save failed: ${json.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: 'Save failed', type: 'error' })
    }
    setSaving(false)
  }

  const handleSyncHolidays = async () => {
    setHolidaySync(true)
    setMsg(null)
    try {
      const res = await fetch('/api/sync/holidays', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const inserted = json.data?.inserted ?? json.data?.count ?? 0
        setMsg({ text: `Holiday sync complete (${inserted} entries)`, type: 'success' })
        await loadAll()
      } else {
        setMsg({ text: `Holiday sync failed: ${json.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: 'Holiday sync failed', type: 'error' })
    }
    setHolidaySync(false)
  }

  const handleSyncFlights = async () => {
    setFlightSync(true)
    setMsg(null)
    try {
      const res = await fetch('/api/sync/flights', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const inserted = json.data?.flights?.inserted ?? json.data?.flights?.count ?? 0
        setMsg({ text: `Flight sync complete (${inserted} entries)`, type: 'success' })
      } else {
        setMsg({ text: `Flight sync failed: ${json.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: 'Flight sync failed', type: 'error' })
    }
    setFlightSync(false)
  }

  const updateRule = async (alertType: string, patch: { is_active?: boolean; threshold?: number | null }) => {
    setRules((prev) => prev.map((r) => (r.alert_type === alertType ? { ...r, ...patch } : r)))
    try {
      await fetch('/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_type: alertType, ...patch }),
      })
    } catch {
      // best effort, leave optimistic state
    }
  }

  const calConnected = !!info?.calendarific.has_key || !!info?.calendarific.env_fallback
  const avConnected = !!info?.aviationstack.has_key || !!info?.aviationstack.env_fallback

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
        <Brain size={16} className="text-indigo-500" />
        <h4 className="text-sm font-semibold text-slate-900">{t('settings.intelligence.title')}</h4>
      </div>

      <div className="p-5 space-y-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            {/* Holiday Monitoring */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-blue-500" />
                  <h5 className="text-sm font-semibold text-slate-800">
                    {t('settings.intelligence.holidayMonitoring')}
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={handleSyncHolidays}
                  disabled={holidaySync}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={holidaySync ? 'animate-spin' : ''} />
                  {holidaySync ? '…' : t('settings.intelligence.syncNow')}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {t('settings.intelligence.holidayDescription')}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                {COUNTRIES.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-700"
                  >
                    <span aria-hidden>{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {t('settings.intelligence.lastSynced')}:{' '}
                {holidayLastSynced
                  ? new Date(holidayLastSynced).toLocaleString()
                  : t('settings.intelligence.never')}
              </p>
            </section>

            {/* Flight Monitoring */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plane size={14} className="text-emerald-500" />
                  <h5 className="text-sm font-semibold text-slate-800">
                    {t('settings.intelligence.flightMonitoring')}
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={handleSyncFlights}
                  disabled={flightSync}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={flightSync ? 'animate-spin' : ''} />
                  {flightSync ? '…' : t('settings.intelligence.syncNow')}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('settings.intelligence.calendarificKey')}
                    {info?.calendarific.has_key && info.calendarific.last4 && (
                      <span className="ml-2 text-slate-400">(••••{info.calendarific.last4})</span>
                    )}
                    {calConnected ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <CheckCircle2 size={11} /> Connected
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                        <AlertCircle size={11} /> Not configured
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={calendarificKey}
                    onChange={(e) => setCalendarificKey(e.target.value)}
                    placeholder={info?.calendarific.has_key ? 'Leave blank to keep current' : 'Calendarific API key'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('settings.intelligence.aviationstackKey')}
                    {info?.aviationstack.has_key && info.aviationstack.last4 && (
                      <span className="ml-2 text-slate-400">(••••{info.aviationstack.last4})</span>
                    )}
                    {avConnected ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <CheckCircle2 size={11} /> Connected
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                        <AlertCircle size={11} /> Not configured
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={aviationstackKey}
                    onChange={(e) => setAviationstackKey(e.target.value)}
                    placeholder={info?.aviationstack.has_key ? 'Leave blank to keep current' : 'AviationStack API key'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {t('settings.intelligence.monitoredAirport')}:{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {info?.monitored_airport ?? 'SGN'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveKeys}
                    disabled={saving || (!calendarificKey && !aviationstackKey)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Keys'}
                  </button>
                </div>
              </div>
            </section>

            {/* Alert Rules */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-amber-500" />
                <h5 className="text-sm font-semibold text-slate-800">
                  {t('settings.intelligence.alertRules')}
                </h5>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {t('settings.intelligence.alertRulesDescription')}
              </p>

              <div className="space-y-2">
                {ALERT_TYPES.map(({ type, thresholdField }) => {
                  const rule = rules.find((r) => r.alert_type === type)
                  const isActive = rule?.is_active ?? true
                  const threshold = rule?.threshold ?? null
                  return (
                    <div
                      key={type}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg"
                    >
                      <span className="text-sm text-slate-800 flex-1 min-w-[140px]">
                        {t(`alerts.types.${type}` as 'alerts.types.flight_spike')}
                      </span>

                      {thresholdField && (
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="whitespace-nowrap">
                            {t(`settings.intelligence.${thresholdField}` as 'settings.intelligence.spikeThreshold')}
                          </span>
                          <input
                            type="number"
                            value={threshold ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value)
                              updateRule(type, { threshold: v })
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        onClick={() => updateRule(type, { is_active: !isActive })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          isActive ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                        aria-label={isActive ? 'Disable' : 'Enable'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            isActive ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
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
