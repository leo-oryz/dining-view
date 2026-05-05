'use client'

import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { BarChart3, RefreshCw, Calendar } from 'lucide-react'
import AdCampaignForm from '@/components/ads/AdCampaignForm'
import AdPerformanceChart from '@/components/ads/AdPerformanceChart'
import { useI18n } from '@/lib/i18n/context'

interface AdCampaign {
  id: string
  date: string
  platform: string
  campaign_name: string
  impressions: number | null
  clicks: number | null
  spend: number | null
  conversions: number | null
  ctr: number | null
  cpc: number | null
  roas: number | null
}

interface CorrelationRow {
  date: string
  ad_spend: number
  ad_clicks: number
  revenue: number | null
}

const platformLabels: Record<string, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
}

type PlatformFilter = 'all' | 'meta' | 'tiktok'

export default function AdsPage() {
  const { t } = useI18n()

  const RANGE_PRESETS = [
    { label: t('ads.last7'), days: 7 },
    { label: t('ads.last14'), days: 14 },
    { label: t('ads.last30'), days: 30 },
    { label: t('ads.last90'), days: 90 },
  ] as const

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [correlation, setCorrelation] = useState<CorrelationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')

  // Date range state — default last 30 days
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'))

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
      const [campRes, perfRes] = await Promise.all([
        fetch(`/api/ads/campaigns?${params}`),
        fetch(`/api/ads/performance?${params}`),
      ])
      const [campJson, perfJson] = await Promise.all([campRes.json(), perfRes.json()])
      if (campJson.success) setCampaigns(campJson.data || [])
      if (perfJson.success) setCorrelation(perfJson.data?.correlation || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  const applyPreset = (days: number) => {
    setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'))
    setEndDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))
  }

  const handleSyncMeta = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync/meta-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      })
      const json = await res.json()
      if (json.success) {
        setSyncResult(`Meta sync done: ${json.data.synced} rows (${json.data.days} days)`)
        fetchData()
      } else {
        setSyncResult(`Meta sync failed: ${json.error}`)
      }
    } catch {
      setSyncResult('Meta sync failed')
    }
    setSyncing(false)
  }

  const handleSyncTiktok = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync/tiktok-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      })
      const json = await res.json()
      if (json.success) {
        setSyncResult(`TikTok sync done: ${json.data.synced} rows (${json.data.date || json.data.days + ' days'})`)
        fetchData()
      } else {
        setSyncResult(`TikTok sync failed: ${json.error}`)
      }
    } catch {
      setSyncResult('TikTok sync failed')
    }
    setSyncing(false)
  }

  // Filter campaigns by platform
  const filteredCampaigns = platformFilter === 'all'
    ? campaigns
    : campaigns.filter(c => c.platform === platformFilter)

  // Aggregate KPIs from filtered campaigns
  const totalSpend = filteredCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0)
  const totalClicks = filteredCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0)
  const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-900">{t('ads.title')}</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncMeta}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? t('common.syncing') : 'Sync Meta'}
          </button>
          <button
            onClick={handleSyncTiktok}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? t('common.syncing') : 'Sync TikTok'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showForm ? t('common.cancel') : t('ads.addRecord')}
          </button>
        </div>
      </div>

      {/* Date range picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{t('ads.dateRange')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-sm">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-1">
            {RANGE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Platform filter */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['all', 'meta', 'tiktok'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              platformFilter === p
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p === 'all' ? t('common.all') : platformLabels[p] || p}
          </button>
        ))}
      </div>

      {/* Sync status */}
      {syncResult && (
        <div className={`text-sm px-4 py-2 rounded-lg ${syncResult.includes('done') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {syncResult}
        </div>
      )}

      {/* Form */}
      {showForm && <AdCampaignForm onCreated={() => { setShowForm(false); fetchData() }} />}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t('ads.totalSpend')}</p>
          <p className="text-lg font-semibold text-slate-900">₫ {totalSpend.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t('ads.totalClicks')}</p>
          <p className="text-lg font-semibold text-slate-900">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t('ads.totalImpressions')}</p>
          <p className="text-lg font-semibold text-slate-900">{totalImpressions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t('ads.avgCtr')}</p>
          <p className="text-lg font-semibold text-slate-900">{avgCtr.toFixed(2)}%</p>
        </div>
      </div>

      {/* Performance chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('ads.spendVsRevenue')}</h4>
        <AdPerformanceChart data={correlation} />
      </div>

      {/* Campaign list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">{t('ads.recordList')}</h4>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('ads.noRecords')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('common.date')}</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('ads.platform')}</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('ads.campaignName')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">{t('ads.spend')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">{t('digital.clicks')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden md:table-cell">{t('digital.ctr')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden md:table-cell">CPC</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500">
                      {format(new Date(c.date), 'yyyy/M/d')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                        {platformLabels[c.platform] || c.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{c.campaign_name}</td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {c.spend != null ? `₫ ${c.spend.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {c.clicks?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden md:table-cell">
                      {c.ctr != null ? `${(c.ctr * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden md:table-cell">
                      {c.cpc != null ? `₫ ${c.cpc.toFixed(1)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
