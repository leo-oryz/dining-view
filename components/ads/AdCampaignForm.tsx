'use client'

import { useState } from 'react'

interface Props {
  onCreated: () => void
}

export default function AdCampaignForm({ onCreated }: Props) {
  const [form, setForm] = useState({
    date: '',
    platform: 'meta',
    campaign_name: '',
    impressions: '',
    clicks: '',
    spend: '',
    conversions: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          impressions: form.impressions ? Number(form.impressions) : null,
          clicks: form.clicks ? Number(form.clicks) : null,
          spend: form.spend ? Number(form.spend) : null,
          conversions: form.conversions ? Number(form.conversions) : null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setForm({ date: '', platform: 'meta', campaign_name: '', impressions: '', clicks: '', spend: '', conversions: '' })
        onCreated()
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">日期 *</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">平台 *</label>
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="meta">Meta (Facebook/IG)</option>
            <option value="tiktok">TikTok</option>
            <option value="google">Google Ads</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">廣告活動名稱 *</label>
          <input
            type="text"
            required
            value={form.campaign_name}
            onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">曝光次數</label>
          <input
            type="number"
            value={form.impressions}
            onChange={(e) => setForm({ ...form, impressions: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">點擊次數</label>
          <input
            type="number"
            value={form.clicks}
            onChange={(e) => setForm({ ...form, clicks: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">花費 (₫)</label>
          <input
            type="number"
            value={form.spend}
            onChange={(e) => setForm({ ...form, spend: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">轉換次數</label>
          <input
            type="number"
            value={form.conversions}
            onChange={(e) => setForm({ ...form, conversions: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {submitting ? '建立中...' : '新增廣告紀錄'}
      </button>
    </form>
  )
}
