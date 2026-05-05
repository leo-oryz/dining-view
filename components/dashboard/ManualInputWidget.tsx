'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

// Asia/Ho_Chi_Minh = UTC+7, no DST.
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

export function ManualInputWidget() {
  const { t } = useI18n()
  const today = todayInHCM()
  const [phoneInquiries, setPhoneInquiries] = useState(0)
  const [walkIns, setWalkIns] = useState(0)
  const [notes, setNotes] = useState('')
  const [hasExisting, setHasExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const storeId = getActiveStoreId()
      if (!storeId) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(
          `/api/manual-metrics?store_id=${storeId}&date=${today}`,
        )
        const json = await res.json()
        if (!cancelled && json.success && json.data) {
          setPhoneInquiries(json.data.phone_inquiries ?? 0)
          setWalkIns(json.data.walk_ins_estimate ?? 0)
          setNotes(json.data.notes ?? '')
          setHasExisting(true)
        }
      } catch {
        // ignore — defaults remain
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today])

  async function handleSave() {
    const storeId = getActiveStoreId()
    if (!storeId) {
      setError(t('manualInput.noStore'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/manual-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          date: today,
          phone_inquiries: phoneInquiries,
          walk_ins_estimate: walkIns,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || t('manualInput.saveFailed'))
      } else {
        setHasExisting(true)
        setSavedAt(Date.now())
        setTimeout(() => setSavedAt(null), 2500)
      }
    } catch {
      setError(t('manualInput.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500 font-medium">
            {t('manualInput.title')}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
        <ClipboardList size={20} className="text-slate-400" />
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('manualInput.phoneInquiries')}
          </label>
          <input
            type="number"
            min={0}
            value={phoneInquiries}
            onChange={(e) => setPhoneInquiries(Math.max(0, Number(e.target.value) || 0))}
            disabled={loading || saving}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('manualInput.walkIns')}
          </label>
          <input
            type="number"
            min={0}
            value={walkIns}
            onChange={(e) => setWalkIns(Math.max(0, Number(e.target.value) || 0))}
            disabled={loading || saving}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('manualInput.notes')}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading || saving}
            placeholder={t('manualInput.notesPlaceholder')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? t('manualInput.saving')
              : hasExisting
                ? t('manualInput.update')
                : t('manualInput.save')}
          </button>
          {savedAt && (
            <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <Check size={16} />
              {t('manualInput.saved')}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
