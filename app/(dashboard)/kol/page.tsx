'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import {
  Users,
  Eye,
  Heart,
  DollarSign,
  Plus,
  RefreshCw,
  Link2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Upload,
  AlertCircle,
  Clock,
  Pencil,
  Trash2,
  Save,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

// ─── Types ───────────────────────────────────────────────────────

interface KolPost {
  id: string
  platform: string
  post_url: string
  post_date: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  sync_status: 'pending' | 'synced' | 'failed'
  sync_error: string | null
  last_synced_at: string | null
}

interface KolCollaboration {
  id: string
  kol_name: string
  kol_handle: string | null
  collaboration_date: string
  featured_products: string[] | null
  collaboration_fee: number | null
  fee_type: string | null
  responsible_staff: string | null
  notes: string | null
  status: string
  kol_posts: KolPost[] | null
}

interface PerformanceRow {
  id: string
  kol_name: string
  kol_handle: string | null
  collaboration_date: string
  collaboration_fee: number | null
  fee_type: string | null
  platforms: string[]
  total_views: number
  total_likes: number
  total_comments: number
  total_shares: number
  engagement_rate: number | null
  sales_delta_pct: number | null
  roi: number | null
  has_typhoon_warning?: boolean
  posts: KolPost[]
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  threads: 'Threads',
  youtube: 'YouTube',
  blogger: 'Blogger',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  tiktok: 'bg-gray-100 text-gray-700',
  threads: 'bg-purple-100 text-purple-700',
  youtube: 'bg-red-100 text-red-700',
  blogger: 'bg-orange-100 text-orange-700',
}

const ALL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'threads', 'youtube', 'blogger'] as const

// ─── Main Page ───────────────────────────────────────────────────

export default function KolPage() {
  const { t } = useI18n()

  const FEE_TYPE_LABELS: Record<string, string> = {
    cash: t('kol.costCash'),
    product: t('kol.costProduct'),
    hybrid: t('kol.costMixed'),
  }

  const RANGE_PRESETS = [
    { label: t('ads.last30'), days: 30 },
    { label: t('ads.last90'), days: 90 },
    { label: t('digital.last180'), days: 180 },
    { label: t('digital.last7').replace('7', '365'), days: 365 },
    { label: t('common.all'), days: 9999 },
  ] as const

  const [collabs, setCollabs] = useState<KolCollaboration[]>([])
  const [performance, setPerformance] = useState<PerformanceRow[]>([])
  const [loading, setLoading] = useState(true)
  // Default: show from 1 year ago to 90 days in the future (to include scheduled collabs)
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 365), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(new Date(new Date().setDate(new Date().getDate() + 90)), 'yyyy-MM-dd'))

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    kol_name: '',
    kol_handle: '',
    collaboration_date: format(new Date(), 'yyyy-MM-dd'),
    featured_products: '',
    collaboration_fee: '',
    fee_type: 'cash' as string,
    responsible_staff: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Post URL input
  const [activeCollabId, setActiveCollabId] = useState<string | null>(null)
  const [postUrl, setPostUrl] = useState('')
  const [addingPost, setAddingPost] = useState(false)
  const [manualPlatform, setManualPlatform] = useState<string>('')
  const [manualViews, setManualViews] = useState('')

  // Edit post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ views: '', likes: '', comments: '', shares: '', saves: '', post_url: '' })

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ total: number; processed: number; errors: { row: number; message: string }[] } | null>(null)

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Ref for post URL input section
  const postInputRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
      const [collabRes, perfRes] = await Promise.all([
        fetch(`/api/kol/collaborations?${params}`),
        fetch(`/api/kol/performance?${params}`),
      ])
      const [collabJson, perfJson] = await Promise.all([collabRes.json(), perfRes.json()])
      if (collabJson.success) setCollabs(collabJson.data || [])
      if (perfJson.success) setPerformance(perfJson.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Scroll to post input when activeCollabId is set
  useEffect(() => {
    if (activeCollabId && postInputRef.current) {
      postInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeCollabId])

  // Auto-detect platform from URL
  const detectedPlatform = (() => {
    if (!postUrl.trim()) return null
    if (/instagram\.com/i.test(postUrl)) return 'instagram'
    if (/facebook\.com/i.test(postUrl)) return 'facebook'
    if (/tiktok\.com/i.test(postUrl)) return 'tiktok'
    if (/threads\.net/i.test(postUrl)) return 'threads'
    if (/youtube\.com|youtu\.be/i.test(postUrl)) return 'youtube'
    if (/pixnet\.net|wordpress\.com|blogger\.com|medium\.com|vocus\.cc/i.test(postUrl)) return 'blogger'
    return null
  })()

  // Effective platform = auto-detected or manually selected
  const effectivePlatform = detectedPlatform || manualPlatform || null
  const isBlogger = effectivePlatform === 'blogger'
  const needsManualSelect = postUrl.trim() && !detectedPlatform

  // ─── Handlers ────────────────────────────────────────────────

  const handleCreateCollab = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/kol/collaborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kol_name: formData.kol_name,
          kol_handle: formData.kol_handle || null,
          collaboration_date: formData.collaboration_date,
          featured_products: formData.featured_products
            ? formData.featured_products.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          collaboration_fee: formData.collaboration_fee ? Number(formData.collaboration_fee) : null,
          fee_type: formData.fee_type,
          responsible_staff: formData.responsible_staff || null,
          notes: formData.notes || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setActiveCollabId(json.data.id)
        setShowForm(false)
        setFormData({
          kol_name: '', kol_handle: '', collaboration_date: format(new Date(), 'yyyy-MM-dd'),
          featured_products: '', collaboration_fee: '', fee_type: 'cash',
          responsible_staff: '', notes: '',
        })
        fetchData()
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPost = async () => {
    if (!activeCollabId || !postUrl.trim() || !effectivePlatform) return
    setAddingPost(true)
    try {
      const res = await fetch('/api/kol/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collaboration_id: activeCollabId,
          post_url: postUrl.trim(),
          platform: effectivePlatform,
          views: manualViews ? Number(manualViews) : undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setPostUrl('')
        setManualPlatform('')
        setManualViews('')
        // Refresh after a short delay to pick up background sync
        setTimeout(() => fetchData(), 5000)
        fetchData()
      }
    } catch {
      // silent
    } finally {
      setAddingPost(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/kol/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setUploadResult(json.data)
        fetchData()
      } else {
        setUploadResult({ total: 0, processed: 0, errors: [{ row: 0, message: json.error }] })
      }
    } catch {
      setUploadResult({ total: 0, processed: 0, errors: [{ row: 0, message: t('common.uploadFailed') }] })
    } finally {
      setUploading(false)
      e.target.value = '' // reset file input
    }
  }

  const handleResync = async (postId: string) => {
    try {
      await fetch(`/api/kol/posts/${postId}/sync`, { method: 'POST' })
      setTimeout(() => fetchData(), 5000)
    } catch {
      // silent
    }
  }

  const handleEditPost = (post: KolPost) => {
    setEditingPostId(post.id)
    setEditForm({
      post_url: post.post_url,
      views: post.views?.toString() || '',
      likes: post.likes?.toString() || '',
      comments: post.comments?.toString() || '',
      shares: post.shares?.toString() || '',
      saves: post.saves?.toString() || '',
    })
  }

  const handleSavePost = async () => {
    if (!editingPostId) return
    try {
      await fetch(`/api/kol/posts/${editingPostId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_url: editForm.post_url,
          views: editForm.views ? Number(editForm.views) : null,
          likes: editForm.likes ? Number(editForm.likes) : null,
          comments: editForm.comments ? Number(editForm.comments) : null,
          shares: editForm.shares ? Number(editForm.shares) : null,
          saves: editForm.saves ? Number(editForm.saves) : null,
        }),
      })
      setEditingPostId(null)
      fetchData()
    } catch {
      // silent
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm(t('kol.deletePostConfirm'))) return
    try {
      await fetch(`/api/kol/posts/${postId}`, { method: 'DELETE' })
      fetchData()
    } catch {
      // silent
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── KPI calculations ───────────────────────────────────────

  const thisMonthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  const monthCollabs = collabs.filter(c => c.collaboration_date >= thisMonthStart)
  const monthPosts = monthCollabs.flatMap(c => c.kol_posts || [])
  const monthViews = monthPosts.reduce((s, p) => s + (p.views || 0), 0)
  const monthLikes = monthPosts.reduce((s, p) => s + (p.likes || 0), 0)
  const monthComments = monthPosts.reduce((s, p) => s + (p.comments || 0), 0)
  const monthShares = monthPosts.reduce((s, p) => s + (p.shares || 0), 0)
  const monthEngagement = monthLikes + monthComments + monthShares
  const avgEngRate = monthViews > 0 ? (monthEngagement / monthViews) * 100 : 0
  const monthFees = monthCollabs.reduce((s, c) => s + (c.collaboration_fee || 0), 0)

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header + Date Range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('kol.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {RANGE_PRESETS.map(rp => (
            <button
              key={rp.days}
              onClick={() => {
                setStartDate(format(subDays(new Date(), rp.days), 'yyyy-MM-dd'))
                // Always include future 90 days to show scheduled collabs
                setEndDate(format(new Date(new Date().setDate(new Date().getDate() + 90)), 'yyyy-MM-dd'))
              }}
              className={`px-3 py-1 rounded text-sm ${
                startDate === format(subDays(new Date(), rp.days), 'yyyy-MM-dd')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {rp.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Batch Upload ─── */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{t('kol.batchUpload')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('kol.uploadCsvHint')}</p>
          </div>
          <label className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium cursor-pointer ${
            uploading ? 'bg-gray-300 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'
          }`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? t('common.uploading') : t('kol.selectCsv')}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
        {uploadResult && (
          <div className={`mt-3 p-3 rounded text-sm ${
            uploadResult.errors.length > 0 ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'
          }`}>
            <p>{t('kol.uploadSuccessPrefix')} {uploadResult.total} {t('kol.uploadSuccessSuffix')} {uploadResult.processed} {t('common.records')}</p>
            {uploadResult.errors.length > 0 && (
              <ul className="mt-1 text-xs space-y-0.5">
                {uploadResult.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{t('kol.uploadRowPrefix')} {e.row} {t('kol.uploadRowSuffix')}: {e.message}</li>
                ))}
                {uploadResult.errors.length > 5 && (
                  <li>...{t('common.moreErrors')} {uploadResult.errors.length - 5} {t('common.errors')}</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 1: KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} title={t('kol.monthlyKol')} value={monthCollabs.length.toString()} />
        <KpiCard icon={Eye} title={t('kol.monthlyReach')} value={monthViews.toLocaleString()} />
        <KpiCard icon={Heart} title={t('kol.avgEngagement')} value={`${avgEngRate.toFixed(2)}%`} />
        <KpiCard icon={DollarSign} title={t('kol.monthlyCost')} value={`NT$${monthFees.toLocaleString()}`} />
      </div>

      {/* ─── Section 2: New Collaboration Form ─── */}
      <div className="bg-white rounded-lg border p-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
        >
          <Plus className="w-4 h-4" />
          {t('kol.addCollab')}
          {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showForm && (
          <form onSubmit={handleCreateCollab} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.kolName')} *</label>
              <input
                type="text"
                required
                value={formData.kol_name}
                onChange={e => setFormData({ ...formData, kol_name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="e.g. 美食達人小明"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.kolHandle')}</label>
              <input
                type="text"
                value={formData.kol_handle}
                onChange={e => setFormData({ ...formData, kol_handle: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="@username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.collabDate')} *</label>
              <input
                type="date"
                required
                value={formData.collaboration_date}
                onChange={e => setFormData({ ...formData, collaboration_date: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.collabProducts')}</label>
              <input
                type="text"
                value={formData.featured_products}
                onChange={e => setFormData({ ...formData, featured_products: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.collabCost')} (NTD)</label>
              <input
                type="number"
                value={formData.collaboration_fee}
                onChange={e => setFormData({ ...formData, collaboration_fee: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.costType')}</label>
              <select
                value={formData.fee_type}
                onChange={e => setFormData({ ...formData, fee_type: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="cash">{t('kol.costCash')}</option>
                <option value="product">{t('kol.costProduct')}</option>
                <option value="hybrid">{t('kol.costMixed')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('kol.manager')}</label>
              <input
                type="text"
                value={formData.responsible_staff}
                onChange={e => setFormData({ ...formData, responsible_staff: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
              <input
                type="text"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t('kol.creating') : t('kol.createCollab')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ─── Section 3: Post URL Input ─── */}
      {activeCollabId && (
        <div ref={postInputRef} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-3">{t('kol.addPostLink')}</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={postUrl}
                onChange={e => setPostUrl(e.target.value)}
                placeholder={t('kol.pastePostLink')}
                className="w-full border rounded px-3 py-2 pl-10 text-sm"
              />
            </div>
            {detectedPlatform && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${PLATFORM_COLORS[detectedPlatform]}`}>
                {PLATFORM_LABELS[detectedPlatform]}
              </span>
            )}
            {needsManualSelect && (
              <select
                value={manualPlatform}
                onChange={e => setManualPlatform(e.target.value)}
                className="border rounded px-2 py-2 text-sm"
              >
                <option value="">{t('kol.selectPlatform')}</option>
                {ALL_PLATFORMS.map(p => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            )}
            {isBlogger && (
              <input
                type="number"
                value={manualViews}
                onChange={e => setManualViews(e.target.value)}
                placeholder={t('kol.viewCount')}
                className="border rounded px-3 py-2 text-sm w-28"
              />
            )}
            <button
              onClick={handleAddPost}
              disabled={addingPost || !postUrl.trim() || !effectivePlatform}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {addingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('common.add')}
            </button>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            {isBlogger
              ? t('kol.blogManualHint')
              : t('kol.socialAutoHint')}
          </p>
          <button
            onClick={() => { setActiveCollabId(null); setManualPlatform(''); setManualViews('') }}
            className="text-xs text-gray-500 mt-1 hover:text-gray-700"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* ─── Section 4: Collaboration List ─── */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t('kol.collabList')}</h2>
          <button
            onClick={fetchData}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('kol.refresh')}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {t('common.loading')}
          </div>
        ) : collabs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t('kol.noRecords')}</div>
        ) : (
          <div className="divide-y">
            {collabs.map(collab => {
              const isExpanded = expandedIds.has(collab.id)
              const posts = collab.kol_posts || []

              return (
                <div key={collab.id} className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleExpand(collab.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{collab.kol_name}</span>
                        {collab.kol_handle && (
                          <span className="text-sm text-gray-500">{collab.kol_handle}</span>
                        )}
                        <span className="text-xs text-gray-400">{collab.collaboration_date}</span>
                        {collab.status === 'completed' && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded">{t('kol.completed')}</span>
                        )}
                      </div>
                      {(collab.featured_products || []).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {(collab.featured_products || []).map((p, i) => (
                            <span key={i} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        {collab.collaboration_fee != null && (
                          <span>{t('kol.cost')}: NT${collab.collaboration_fee.toLocaleString()} ({FEE_TYPE_LABELS[collab.fee_type || ''] || collab.fee_type})</span>
                        )}
                        <span>{t('kol.posts')}: {posts.length} {t('kol.postsCount')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setActiveCollabId(collab.id)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        + {t('kol.posts')}
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isExpanded && posts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {posts.map(post => editingPostId === post.id ? (
                        /* ── Edit Mode ── */
                        <div key={post.id} className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[post.platform]}`}>
                              {PLATFORM_LABELS[post.platform]}
                            </span>
                            <input
                              type="url"
                              value={editForm.post_url}
                              onChange={e => setEditForm({ ...editForm, post_url: e.target.value })}
                              className="flex-1 border rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              {t('kol.views')} <input type="number" value={editForm.views} onChange={e => setEditForm({ ...editForm, views: e.target.value })} className="border rounded px-1.5 py-0.5 w-20 text-xs" />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              {t('kol.likes')} <input type="number" value={editForm.likes} onChange={e => setEditForm({ ...editForm, likes: e.target.value })} className="border rounded px-1.5 py-0.5 w-20 text-xs" />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              {t('kol.comments')} <input type="number" value={editForm.comments} onChange={e => setEditForm({ ...editForm, comments: e.target.value })} className="border rounded px-1.5 py-0.5 w-20 text-xs" />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              {t('kol.shares')} <input type="number" value={editForm.shares} onChange={e => setEditForm({ ...editForm, shares: e.target.value })} className="border rounded px-1.5 py-0.5 w-20 text-xs" />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              {t('kol.saves')} <input type="number" value={editForm.saves} onChange={e => setEditForm({ ...editForm, saves: e.target.value })} className="border rounded px-1.5 py-0.5 w-20 text-xs" />
                            </label>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingPostId(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                              <X className="w-3 h-3" /> {t('common.cancel')}
                            </button>
                            <button onClick={handleSavePost} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                              <Save className="w-3 h-3" /> {t('common.save')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── View Mode ── */
                        <div
                          key={post.id}
                          className="bg-gray-50 rounded p-3 flex items-center justify-between gap-4 text-sm"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[post.platform]}`}>
                              {PLATFORM_LABELS[post.platform]}
                            </span>
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate"
                            >
                              {post.post_url}
                            </a>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 whitespace-nowrap">
                            {post.sync_status === 'synced' && (
                              <>
                                {post.views != null && <span>{t('kol.views')} {post.views.toLocaleString()}</span>}
                                {post.likes != null && <span>{t('kol.likes')} {post.likes.toLocaleString()}</span>}
                                {post.comments != null && <span>{t('kol.comments')} {post.comments.toLocaleString()}</span>}
                                {post.shares != null && <span>{t('kol.shares')} {post.shares.toLocaleString()}</span>}
                              </>
                            )}
                            {post.sync_status === 'pending' && (
                              <span className="flex items-center gap-1 text-yellow-600">
                                <Clock className="w-3.5 h-3.5" /> {t('kol.syncInProgress')}
                              </span>
                            )}
                            {post.sync_status === 'failed' && (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="flex items-center gap-1 text-red-500">
                                  <AlertCircle className="w-3.5 h-3.5" /> {t('kol.syncFailed')}
                                </span>
                                {post.sync_error && (
                                  <span className="text-[10px] text-red-400 max-w-[200px] truncate" title={post.sync_error}>
                                    {post.sync_error}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Action buttons */}
                            <div className="flex items-center gap-1 ml-1 border-l pl-2">
                              {post.sync_status === 'failed' && (
                                <button onClick={() => handleResync(post.id)} className="text-blue-600 hover:text-blue-700" title={t('kol.resync')}>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => handleEditPost(post)} className="text-gray-400 hover:text-gray-600" title={t('common.edit')}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeletePost(post.id)} className="text-gray-400 hover:text-red-500" title={t('common.delete')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && posts.length === 0 && (
                    <p className="mt-3 text-sm text-gray-400">{t('kol.noPosts')}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Section 5: Performance Comparison Table ─── */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">{t('kol.comparison')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">KOL</th>
                <th className="px-4 py-3 font-medium">{t('ads.platform')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('kol.reach')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('kol.engagementRate')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('kol.cost')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('kol.salesChange')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('kol.roi')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...performance]
                .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
                .map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.kol_name}</div>
                      {row.kol_handle && (
                        <div className="text-xs text-gray-500">{row.kol_handle}</div>
                      )}
                      <div className="text-xs text-gray-400">{row.collaboration_date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(row.platforms || []).map(p => (
                          <span key={p} className={`px-1.5 py-0.5 rounded text-xs ${PLATFORM_COLORS[p]}`}>
                            {PLATFORM_LABELS[p]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{row.total_views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {row.engagement_rate != null
                        ? `${(row.engagement_rate * 100).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.collaboration_fee
                        ? `NT$${row.collaboration_fee.toLocaleString()}`
                        : '—'}
                      {row.fee_type && (
                        <div className="text-xs text-gray-400">{FEE_TYPE_LABELS[row.fee_type] || row.fee_type}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.sales_delta_pct != null ? (
                        <span className={row.sales_delta_pct >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {row.sales_delta_pct >= 0 ? '+' : ''}{row.sales_delta_pct.toFixed(1)}%
                        </span>
                      ) : '—'}
                      {row.has_typhoon_warning && (
                        <div className="text-xs text-amber-600 mt-0.5">🌀 {t('kol.typhoonDisclaimer')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.collaboration_fee && row.collaboration_fee > 0 && row.roi != null
                        ? (
                          <span className={row.roi >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {row.roi >= 0 ? '+' : ''}{row.roi.toFixed(0)}%
                          </span>
                        )
                        : '—'}
                    </td>
                  </tr>
                ))}
              {performance.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {t('kol.noPerformanceData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card Component ──────────────────────────────────────────

function KpiCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
