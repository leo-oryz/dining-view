'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar, Plus, Edit2, Trash2, Send, Loader2, X, Mail, CheckCircle, XCircle } from 'lucide-react'
import { APP_TIMEZONE } from '@/lib/constants/timezone'

type Schedule = {
  id: string
  name: string
  is_active: boolean
  frequency: 'weekly' | 'monthly'
  day_of_week: number | null
  day_of_month: number | null
  send_hour: number
  send_minute: number
  timezone: string
  period_type: 'last_week' | 'last_month'
  report_types: string[]
  depth: 'concise' | 'standard' | 'detailed'
  recipient_roles: string[]
  extra_emails: string[]
  next_run_at: string | null
  last_run_at: string | null
  last_run_status: 'success' | 'error' | null
  last_run_error: string | null
}

type Form = {
  name: string
  is_active: boolean
  frequency: 'weekly' | 'monthly'
  day_of_week: number
  day_of_month: number
  send_hour: number
  send_minute: number
  period_type: 'last_week' | 'last_month'
  report_types: string[]
  depth: 'concise' | 'standard' | 'detailed'
  recipient_roles: string[]
  extra_emails: string[]
}

const emptyForm: Form = {
  name: '',
  is_active: true,
  frequency: 'weekly',
  day_of_week: 1,
  day_of_month: 1,
  send_hour: 9,
  send_minute: 0,
  period_type: 'last_week',
  report_types: ['attribution', 'star_products', 'retire_candidates'],
  depth: 'standard',
  recipient_roles: ['owner', 'marketing'],
  extra_emails: [],
}

const DOW_LABELS = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日']
const REPORT_TYPE_OPTIONS = [
  { value: 'attribution', label: '營收歸因分析' },
  { value: 'star_products', label: '明星商品分析' },
  { value: 'retire_candidates', label: '下架候選分析' },
]
const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'investor', label: 'Investor' },
]
const DEPTH_OPTIONS = [
  { value: 'concise', label: '簡短（120 字摘要）' },
  { value: 'standard', label: '標準（200 字摘要）' },
  { value: 'detailed', label: '詳細（400 字摘要）' },
]

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-medium text-slate-700 mb-1'

function formatNextRun(iso: string | null, tz = APP_TIMEZONE): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-TW', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return iso
  }
}

function describeSchedule(s: Schedule | Form): string {
  const time = `${String(s.send_hour).padStart(2, '0')}:${String(s.send_minute).padStart(2, '0')}`
  if (s.frequency === 'weekly') {
    return `每${DOW_LABELS[s.day_of_week || 1]} ${time}`
  }
  return `每月 ${s.day_of_month || 1} 號 ${time}`
}

export default function ReportSchedulesPanel({ isOwner }: { isOwner: boolean }) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [emailInput, setEmailInput] = useState('')

  const fetchAll = useCallback(() => {
    setLoading(true)
    fetch('/api/settings/report-schedules')
      .then(r => r.json())
      .then(j => { if (j.success) setSchedules(j.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (isOwner) fetchAll() }, [isOwner, fetchAll])

  if (!isOwner) return null

  const reset = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); setEmailInput('') }

  const startEdit = (s: Schedule) => {
    setEditId(s.id)
    setShowForm(false)
    setForm({
      name: s.name,
      is_active: s.is_active,
      frequency: s.frequency,
      day_of_week: s.day_of_week ?? 1,
      day_of_month: s.day_of_month ?? 1,
      send_hour: s.send_hour,
      send_minute: s.send_minute,
      period_type: s.period_type,
      report_types: s.report_types,
      depth: s.depth,
      recipient_roles: s.recipient_roles,
      extra_emails: s.extra_emails,
    })
    setEmailInput('')
  }

  const buildPayload = () => ({
    name: form.name.trim(),
    is_active: form.is_active,
    frequency: form.frequency,
    day_of_week: form.frequency === 'weekly' ? form.day_of_week : null,
    day_of_month: form.frequency === 'monthly' ? form.day_of_month : null,
    send_hour: form.send_hour,
    send_minute: form.send_minute,
    timezone: APP_TIMEZONE,
    period_type: form.period_type,
    report_types: form.report_types,
    depth: form.depth,
    recipient_roles: form.recipient_roles,
    extra_emails: form.extra_emails,
  })

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ text: '請填寫名稱', type: 'error' }); return }
    setSaving(true); setMsg(null)
    try {
      const url = editId ? `/api/settings/report-schedules/${editId}` : '/api/settings/report-schedules'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const j = await res.json()
      if (j.success) {
        setMsg({ text: editId ? '已更新' : '已新增', type: 'success' })
        reset(); fetchAll()
      } else {
        setMsg({ text: `儲存失敗：${j.error}`, type: 'error' })
      }
    } catch {
      setMsg({ text: '儲存失敗', type: 'error' })
    }
    setSaving(false)
  }

  const remove = async (s: Schedule) => {
    if (!window.confirm(`確定刪除「${s.name}」？`)) return
    setBusyId(s.id); setMsg(null)
    try {
      const res = await fetch(`/api/settings/report-schedules/${s.id}`, { method: 'DELETE' })
      const j = await res.json()
      if (j.success) { setMsg({ text: '已刪除', type: 'success' }); fetchAll() }
      else { setMsg({ text: `刪除失敗：${j.error}`, type: 'error' }) }
    } catch { setMsg({ text: '刪除失敗', type: 'error' }) }
    setBusyId(null)
  }

  const runNow = async (s: Schedule) => {
    if (!window.confirm(`立即發送一次「${s.name}」？這會真的寄信給收件人。`)) return
    setBusyId(s.id); setMsg(null)
    try {
      const res = await fetch(`/api/settings/report-schedules/${s.id}/run-now`, { method: 'POST' })
      const j = await res.json()
      if (j.success) {
        setMsg({ text: `已發送（${j.data.reportsGenerated} 份報告，${j.data.recipientCount} 位收件人）`, type: 'success' })
        fetchAll()
      } else {
        setMsg({ text: `發送失敗：${j.error}`, type: 'error' })
      }
    } catch { setMsg({ text: '發送失敗', type: 'error' }) }
    setBusyId(null)
  }

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

  const addEmail = () => {
    const e = emailInput.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return
    if (form.extra_emails.includes(e)) { setEmailInput(''); return }
    setForm(f => ({ ...f, extra_emails: [...f.extra_emails, e] }))
    setEmailInput('')
  }

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>排程名稱 *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="例：每週週報" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>狀態</label>
          <select value={form.is_active ? '1' : '0'}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.value === '1' }))}
            className={inputCls}>
            <option value="1">啟用</option>
            <option value="0">停用</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>頻率</label>
          <select value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value as 'weekly' | 'monthly' }))}
            className={inputCls}>
            <option value="weekly">每週</option>
            <option value="monthly">每月</option>
          </select>
        </div>
        {form.frequency === 'weekly' ? (
          <div>
            <label className={labelCls}>星期幾</label>
            <select value={form.day_of_week}
              onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
              className={inputCls}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{DOW_LABELS[d]}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelCls}>每月幾號 (1–28)</label>
            <input type="number" min={1} max={28} value={form.day_of_month}
              onChange={e => setForm(f => ({ ...f, day_of_month: Math.max(1, Math.min(28, Number(e.target.value) || 1)) }))}
              className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>{`寄出時間 (${APP_TIMEZONE})`}</label>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={23} value={form.send_hour}
              onChange={e => setForm(f => ({ ...f, send_hour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) }))}
              className={inputCls} />
            <span className="text-slate-400">:</span>
            <input type="number" min={0} max={59} step={5} value={form.send_minute}
              onChange={e => setForm(f => ({ ...f, send_minute: Math.max(0, Math.min(59, Number(e.target.value) || 0)) }))}
              className={inputCls} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>報告期間</label>
          <select value={form.period_type}
            onChange={e => setForm(f => ({ ...f, period_type: e.target.value as 'last_week' | 'last_month' }))}
            className={inputCls}>
            <option value="last_week">上週（週一 ~ 週日）</option>
            <option value="last_month">上個月（整月）</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>報告長度</label>
          <select value={form.depth}
            onChange={e => setForm(f => ({ ...f, depth: e.target.value as Form['depth'] }))}
            className={inputCls}>
            {DEPTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>產生哪些報告</label>
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPE_OPTIONS.map(o => {
            const on = form.report_types.includes(o.value)
            return (
              <button key={o.value} type="button"
                onClick={() => setForm(f => ({ ...f, report_types: toggleArr(f.report_types, o.value) }))}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  on ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}>
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>收件人角色（自動取所有啟用中的該角色用戶）</label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(o => {
            const on = form.recipient_roles.includes(o.value)
            return (
              <button key={o.value} type="button"
                onClick={() => setForm(f => ({ ...f, recipient_roles: toggleArr(f.recipient_roles, o.value) }))}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  on ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}>
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>額外收件人 (Email)</label>
        <div className="space-y-2 mb-2">
          {form.extra_emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <Mail size={14} className="text-slate-400" />
              <span className="text-sm text-slate-700 flex-1">{e}</span>
              <button type="button" onClick={() => setForm(f => ({ ...f, extra_emails: f.extra_emails.filter((_, idx) => idx !== i) }))}
                className="p-1 text-slate-400 hover:text-red-500"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
            placeholder="other@example.com"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
            className={inputCls} />
          <button type="button" onClick={addEmail}
            className="px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200">新增</button>
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
        摘要：<strong>{describeSchedule(form)}</strong> 寄送
        <strong>{form.period_type === 'last_week' ? '上週' : '上月'}</strong>的
        <strong>{form.report_types.length}</strong> 份報告
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={submit} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中…' : (editId ? '儲存' : '新增')}
        </button>
        <button type="button" onClick={reset}
          className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">取消</button>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-emerald-500" />
          <h4 className="text-sm font-semibold text-slate-900">AI 報告排程</h4>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...emptyForm }) }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
          <Plus size={14} />新增排程
        </button>
      </div>

      {msg && (
        <div className={`mx-5 mt-3 text-sm px-4 py-2 rounded-lg ${
          msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{msg.text}</div>
      )}

      {showForm && !editId && (
        <div className="p-5 border-b border-slate-200">{renderForm()}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          <Loader2 size={16} className="inline animate-spin mr-2" />載入中…
        </div>
      ) : schedules.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">尚未設定任何排程</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {schedules.map(s => (
            <div key={s.id}>
              {editId === s.id ? (
                <div className="p-5 bg-blue-50/30">
                  <h5 className="text-sm font-semibold text-slate-900 mb-4">編輯：{s.name}</h5>
                  {renderForm()}
                </div>
              ) : (
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-slate-900">{s.name}</span>
                        {s.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-full">
                            <CheckCircle size={11} /> 啟用
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                            <XCircle size={11} /> 停用
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>{describeSchedule(s)}（{APP_TIMEZONE}）寄送 {s.period_type === 'last_week' ? '上週' : '上月'} {s.report_types.length} 份報告 · {s.depth === 'concise' ? '簡短' : s.depth === 'detailed' ? '詳細' : '標準'}</div>
                        <div className="text-slate-500">
                          下次：{formatNextRun(s.next_run_at)}
                          上次：{formatNextRun(s.last_run_at)}
                          {s.last_run_status === 'error' && <span className="text-red-500 ml-2">⚠ {s.last_run_error}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => runNow(s)} disabled={busyId === s.id}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50" title="立即發送">
                        {busyId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                      <button onClick={() => startEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="編輯">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => remove(s)} disabled={busyId === s.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="刪除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
