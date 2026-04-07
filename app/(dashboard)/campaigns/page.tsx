'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

interface Campaign {
  id: string
  name: string
  type: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  budget: number | null
  status: string
  recurrence_type: string
  recurrence_days: number[] | null
  created_at: string
}

type FormState = {
  name: string
  type: string
  start_date: string
  end_date: string
  description: string
  budget: string
  status: string
  recurrence_type: 'once' | 'weekly'
  recurrence_days: number[]
}

const emptyForm: FormState = {
  name: '', type: '', start_date: '', end_date: '', description: '', budget: '', status: 'planned',
  recurrence_type: 'once', recurrence_days: [],
}

export default function CampaignsPage() {
  const { t } = useI18n()

  const DAY_LABELS = t('campaigns.weekdays').split('/')

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = () => {
    fetch('/api/campaigns')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setCampaigns(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter((d) => d !== day)
        : [...prev.recurrence_days, day].sort(),
    }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowForm(true)
    setError(null)
  }

  const openEdit = (c: Campaign) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      type: c.type || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      description: c.description || '',
      budget: c.budget != null ? String(c.budget) : '',
      status: c.status,
      recurrence_type: (c.recurrence_type as 'once' | 'weekly') || 'once',
      recurrence_days: c.recurrence_days || [],
    })
    setShowForm(true)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      ...form,
      budget: form.budget ? Number(form.budget) : null,
      recurrence_days: form.recurrence_type === 'weekly' ? form.recurrence_days : null,
    }

    try {
      const url = editingId ? `/api/campaigns/${editingId}` : '/api/campaigns'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        setShowForm(false)
        setEditingId(null)
        setForm({ ...emptyForm })
        fetchCampaigns()
      } else {
        setError(json.error || (editingId ? t('campaigns.updateFailed') : t('campaigns.createFailed')))
      }
    } catch {
      setError(t('campaigns.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (c: Campaign) => {
    if (!window.confirm(`${t('campaigns.deleteConfirm')}「${c.name}」？${t('campaigns.deleteWarning')}。`)) return

    try {
      const res = await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchCampaigns()
      } else {
        alert(`${t('campaigns.deleteFailed')}：${json.error}`)
      }
    } catch {
      alert(t('campaigns.deleteFailed'))
    }
  }

  const statusColors: Record<string, string> = {
    planned: 'bg-yellow-100 text-yellow-800',
    active: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-slate-100 text-slate-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  const formatDateColumn = (c: Campaign) => {
    if (c.recurrence_type === 'weekly' && c.recurrence_days) {
      const days = c.recurrence_days.map((d) => DAY_LABELS[d]).join('、')
      return `${t('campaigns.weekly')}${days}`
    }
    const start = c.start_date ? format(new Date(c.start_date), 'yyyy/M/d') : '-'
    const end = c.end_date ? ` ~ ${format(new Date(c.end_date), 'M/d')}` : ''
    return `${start}${end}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{t('campaigns.title')}</h3>
        <button
          onClick={() => showForm ? (setShowForm(false), setEditingId(null)) : openCreate()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? t('common.cancel') : t('campaigns.addCampaign')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900">
            {editingId ? t('campaigns.editCampaign') : t('campaigns.addCampaign')}
          </h4>

          {/* Recurrence type radio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('campaigns.type')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence_type"
                  value="once"
                  checked={form.recurrence_type === 'once'}
                  onChange={() => setForm({ ...form, recurrence_type: 'once', recurrence_days: [] })}
                  className="text-blue-600"
                />
                <span className="text-sm text-slate-700">{t('campaigns.typeOneTime')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence_type"
                  value="weekly"
                  checked={form.recurrence_type === 'weekly'}
                  onChange={() => setForm({ ...form, recurrence_type: 'weekly' })}
                  className="text-blue-600"
                />
                <span className="text-sm text-slate-700">{t('campaigns.typePeriodic')}</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('campaigns.campaignName')} *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('campaigns.type')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('campaigns.selectType')}</option>
                <option value="discount">{t('campaigns.typeDiscount')}</option>
                <option value="event">{t('campaigns.typeEvent')}</option>
                <option value="holiday">{t('campaigns.typeHoliday')}</option>
                <option value="new_product">{t('campaigns.typeNewProduct')}</option>
                <option value="other">{t('campaigns.typeOther')}</option>
              </select>
            </div>

            {/* Weekly: day-of-week checkboxes */}
            {form.recurrence_type === 'weekly' && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('campaigns.repeatDays')} *</label>
                <div className="flex gap-2">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium border transition-colors ${
                        form.recurrence_days.includes(idx)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {form.recurrence_type === 'weekly' ? t('campaigns.effectiveStart') : t('campaigns.startDate')}
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {form.recurrence_type === 'weekly' ? t('campaigns.effectiveEnd') : t('campaigns.endDate')}
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('campaigns.budget')}</label>
              <input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status selector — only show when editing */}
            {editingId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.status')}</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('campaigns.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || (form.recurrence_type === 'weekly' && form.recurrence_days.length === 0)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? (editingId ? t('campaigns.updating') : t('campaigns.creating')) : (editingId ? t('campaigns.updateCampaign') : t('campaigns.createCampaign'))}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null) }}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Campaign list */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('campaigns.noRecords')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('campaigns.campaignName')}</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">{t('campaigns.type')}</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('common.date')}</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('common.status')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">{t('campaigns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{c.name}</span>
                      {c.recurrence_type === 'weekly' ? (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">{t('campaigns.cycle')}</span>
                      ) : (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{t('campaigns.oneTime')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{c.type || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateColumn(c)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[c.status] || ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
