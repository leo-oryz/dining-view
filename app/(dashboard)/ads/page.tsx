'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { BarChart3, RefreshCw } from 'lucide-react'
import AdCampaignForm from '@/components/ads/AdCampaignForm'
import AdPerformanceChart from '@/components/ads/AdPerformanceChart'

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
  other: '其他',
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [correlation, setCorrelation] = useState<CorrelationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [campRes, perfRes] = await Promise.all([
        fetch('/api/ads/campaigns'),
        fetch('/api/ads/performance'),
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
  }, [])

  // Aggregate KPIs
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0)
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-900">廣告管理</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setSyncing(true)
              setSyncResult(null)
              try {
                const res = await fetch('/api/sync/meta-ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                const json = await res.json()
                if (json.success) {
                  setSyncResult(`Meta 同步完成：${json.data.synced} 筆 (${json.data.date})`)
                  setLastSynced(new Date().toISOString())
                  fetchData()
                } else {
                  setSyncResult(`同步失敗：${json.error}`)
                }
              } catch {
                setSyncResult('同步失敗')
              }
              setSyncing(false)
            }}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? '同步中...' : 'Sync from Meta'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showForm ? '取消' : '新增廣告紀錄'}
          </button>
        </div>
      </div>

      {/* Sync status */}
      {syncResult && (
        <div className={`text-sm px-4 py-2 rounded-lg ${syncResult.includes('完成') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {syncResult}
        </div>
      )}
      {lastSynced && (
        <p className="text-xs text-slate-400">上次同步：{format(new Date(lastSynced), 'yyyy/M/d HH:mm')}</p>
      )}

      {/* Form */}
      {showForm && <AdCampaignForm onCreated={() => { setShowForm(false); fetchData() }} />}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">總花費</p>
          <p className="text-lg font-semibold text-slate-900">NT$ {totalSpend.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">總點擊</p>
          <p className="text-lg font-semibold text-slate-900">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">總曝光</p>
          <p className="text-lg font-semibold text-slate-900">{totalImpressions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">平均 CTR</p>
          <p className="text-lg font-semibold text-slate-900">{avgCtr.toFixed(2)}%</p>
        </div>
      </div>

      {/* Performance chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">廣告花費 vs 營收</h4>
        <AdPerformanceChart data={correlation} />
      </div>

      {/* Campaign list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">廣告紀錄</h4>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">尚無廣告紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">日期</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">平台</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">活動名稱</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">花費</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">點擊</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden md:table-cell">CTR</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden md:table-cell">CPC</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
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
                      {c.spend != null ? `NT$ ${c.spend.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {c.clicks?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden md:table-cell">
                      {c.ctr != null ? `${(c.ctr * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden md:table-cell">
                      {c.cpc != null ? `NT$ ${c.cpc.toFixed(1)}` : '-'}
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
