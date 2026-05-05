'use client'

import { useEffect, useState } from 'react'
import { Check, BookOpen } from 'lucide-react'

function todayInHCM(): string {
  const now = new Date()
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

function getActiveStoreId(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)active_store_id=([^;]+)/)
  return match?.[1] ?? null
}

interface XhsEntry {
  date: string
  followers: number | null
  total_likes: number | null
  total_comments: number | null
  top_post_title: string | null
  top_post_views: number | null
  notes: string | null
}

interface Props {
  onSaved?: () => void
  initialDate?: string
}

export default function XhsManualInputForm({ onSaved, initialDate }: Props) {
  const [date, setDate] = useState(initialDate ?? todayInHCM())
  const [followers, setFollowers] = useState<string>('')
  const [totalLikes, setTotalLikes] = useState<string>('')
  const [totalComments, setTotalComments] = useState<string>('')
  const [topPostTitle, setTopPostTitle] = useState('')
  const [topPostViews, setTopPostViews] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [hasExisting, setHasExisting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastEntryDate, setLastEntryDate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const storeId = getActiveStoreId()
      if (!storeId) return
      setLoading(true)
      try {
        const [entryRes, listRes] = await Promise.all([
          fetch(`/api/xhs-metrics?store_id=${storeId}&date=${date}`),
          fetch(`/api/xhs-metrics?store_id=${storeId}`),
        ])
        const entry = await entryRes.json()
        const list = await listRes.json()
        if (cancelled) return
        if (entry.success && entry.data) {
          const d = entry.data as XhsEntry
          setFollowers(d.followers != null ? String(d.followers) : '')
          setTotalLikes(d.total_likes != null ? String(d.total_likes) : '')
          setTotalComments(d.total_comments != null ? String(d.total_comments) : '')
          setTopPostTitle(d.top_post_title ?? '')
          setTopPostViews(d.top_post_views != null ? String(d.top_post_views) : '')
          setNotes(d.notes ?? '')
          setHasExisting(true)
        } else {
          setFollowers('')
          setTotalLikes('')
          setTotalComments('')
          setTopPostTitle('')
          setTopPostViews('')
          setNotes('')
          setHasExisting(false)
        }
        if (list.success && Array.isArray(list.data) && list.data.length > 0) {
          setLastEntryDate((list.data[0] as XhsEntry).date)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [date])

  function toIntOrNull(v: string): number | null {
    if (!v.trim()) return null
    const n = Math.floor(Number(v))
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  async function handleSave() {
    const storeId = getActiveStoreId()
    if (!storeId) {
      setError('No active store selected')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/xhs-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          date,
          followers: toIntOrNull(followers),
          total_likes: toIntOrNull(totalLikes),
          total_comments: toIntOrNull(totalComments),
          top_post_title: topPostTitle.trim() || null,
          top_post_views: toIntOrNull(topPostViews),
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Save failed')
      } else {
        setHasExisting(true)
        setSavedAt(Date.now())
        setTimeout(() => setSavedAt(null), 2500)
        onSaved?.()
      }
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-rose-500" />
          <h3 className="text-sm font-semibold text-slate-900">Xiaohongshu Weekly Entry</h3>
        </div>
        {lastEntryDate && (
          <span className="text-xs text-slate-400">Last entry: {lastEntryDate}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Followers</label>
          <input
            type="number"
            min={0}
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Total Likes</label>
          <input
            type="number"
            min={0}
            value={totalLikes}
            onChange={(e) => setTotalLikes(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Total Comments</label>
          <input
            type="number"
            min={0}
            value={totalComments}
            onChange={(e) => setTotalComments(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Top Post Title</label>
          <input
            type="text"
            value={topPostTitle}
            onChange={(e) => setTopPostTitle(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Top Post Views</label>
          <input
            type="number"
            min={0}
            value={topPostViews}
            onChange={(e) => setTopPostViews(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving || loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : hasExisting ? 'Update Entry' : 'Save Entry'}
        </button>
        {savedAt && (
          <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
            <Check size={16} /> Saved
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}
