'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Plus, Store, CheckCircle, XCircle, Users, UserPlus,
  Shield, Edit2, Ban, RotateCcw, MapPin, Phone, Calendar, Armchair,
  ExternalLink, User, Power, PowerOff, Trash2, Target, ChevronLeft, ChevronRight,
  Mail, Bell, X, Send, Cloud, RefreshCw,
} from 'lucide-react'

interface StoreInfo {
  id: string
  name: string
  location: string | null
  timezone: string
  is_active: boolean
  created_at: string
  phone: string | null
  business_hours: string | null
  opened_date: string | null
  google_maps_url: string | null
  google_place_id: string | null
  seat_count: number | null
  manager_name: string | null
  manager_email: string | null
}

interface TeamMember {
  id: string
  email: string
  name: string | null
  display_name: string | null
  role: string
  store_id: string | null
  store_name: string | null
  is_active: boolean
  invited_by: string | null
  invited_at: string | null
  created_at: string
  auth_id: string | null
}

interface UserMe {
  role: string
}

interface StoreFormData {
  name: string
  location: string
  timezone: string
  phone: string
  business_hours: string
  opened_date: string
  seat_count: string
  google_maps_url: string
  google_place_id: string
  manager_name: string
  manager_email: string
  eat365_email: string
  eat365_password: string
  ocard_email: string
  ocard_password: string
}

const emptyForm: StoreFormData = {
  name: '', location: '', timezone: 'Asia/Taipei',
  phone: '', business_hours: '', opened_date: '', seat_count: '',
  google_maps_url: '', google_place_id: '',
  manager_name: '', manager_email: '',
  eat365_email: '', eat365_password: '',
  ocard_email: '', ocard_password: '',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', manager: 'Manager', marketing: 'Marketing', investor: 'Investor',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: '看所有分店所有數據，可管理團隊',
  manager: '只看指定分店，不能管理團隊',
  marketing: '看所有分店數據（唯讀），不能管理團隊',
  investor: '查看投資相關數據',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  marketing: 'bg-green-100 text-green-700',
  investor: 'bg-amber-100 text-amber-700',
}

// ─── Weather Settings Panel ─────────────────────────────────────────
function WeatherSettingsPanel() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [info, setInfo] = useState<{ count: number; minDate: string; maxDate: string } | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weather/range?from=2000-01-01&to=2099-12-31')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.length > 0) {
          const rows = json.data as { date: string }[]
          setInfo({
            count: rows.length,
            minDate: rows[0].date,
            maxDate: rows[rows.length - 1].date,
          })
        }
      })
      .catch(() => {})
      .finally(() => setInfoLoading(false))
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/weather/sync', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setSyncResult(`同步成功：${json.data.date}，共 ${json.data.stores} 個門市`)
        // Refresh info
        const infoRes = await fetch('/api/weather/range?from=2000-01-01&to=2099-12-31')
        const infoJson = await infoRes.json()
        if (infoJson.success && infoJson.data?.length > 0) {
          const rows = infoJson.data as { date: string }[]
          setInfo({ count: rows.length, minDate: rows[0].date, maxDate: rows[rows.length - 1].date })
        }
      } else {
        setSyncResult(`同步失敗：${json.error}`)
      }
    } catch {
      setSyncResult('同步失敗')
    }
    setSyncing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={16} className="text-blue-500" />
          <h4 className="text-sm font-semibold text-slate-900">天氣數據</h4>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中...' : '立即同步'}
        </button>
      </div>
      <div className="p-5 space-y-3">
        {infoLoading ? (
          <p className="text-sm text-slate-400">載入中...</p>
        ) : info ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">已有數據</p>
              <p className="text-sm font-semibold text-slate-900">{info.count} 筆</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">最早日期</p>
              <p className="text-sm font-semibold text-slate-900">{info.minDate}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">最新日期</p>
              <p className="text-sm font-semibold text-slate-900">{info.maxDate}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">尚無天氣數據，請點擊「立即同步」</p>
        )}
        <p className="text-xs text-slate-400">
          數據來源：中央氣象署（CWA），每日自動同步一次。
        </p>
        {syncResult && (
          <div className={`text-sm px-3 py-2 rounded-lg ${syncResult.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {syncResult}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Store Form Component ───────────────────────────────────────────
function StoreForm({
  form, onChange, onSubmit, onCancel, saving, submitLabel,
}: {
  form: StoreFormData
  onChange: (f: StoreFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  const set = (field: keyof StoreFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [field]: e.target.value })

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-slate-700 mb-1'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 基本資訊 */}
      <div>
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">基本資訊</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>門市名稱 *</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="例：BE& 信義" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>地址</label>
            <input type="text" value={form.location} onChange={set('location')} placeholder="例：台北市信義區..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>電話</label>
            <input type="text" value={form.phone} onChange={set('phone')} placeholder="例：02-2345-6789" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>時區</label>
            <select value={form.timezone} onChange={set('timezone')} className={inputCls}>
              <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
              <option value="Asia/Hong_Kong">Asia/Hong_Kong (UTC+8)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>開業日期</label>
            <input type="date" value={form.opened_date} onChange={set('opened_date')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>營業時間</label>
            <input type="text" value={form.business_hours} onChange={set('business_hours')} placeholder="08:00–19:00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>座位數</label>
            <input type="number" value={form.seat_count} onChange={set('seat_count')} placeholder="例：50" min="0" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Google 評論整合 */}
      <div className="border-t border-slate-200 pt-4">
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Google 評論整合</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Google Maps 連結</label>
            <input type="url" value={form.google_maps_url} onChange={set('google_maps_url')} placeholder="https://maps.google.com/..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Google Place ID</label>
            <input type="text" value={form.google_place_id} onChange={set('google_place_id')} placeholder="ChIJxxxxxxxx" className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">
              用於自動抓取 Google 評論。
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline ml-1"
              >
                如何找到 Place ID？
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* 營運負責人 */}
      <div className="border-t border-slate-200 pt-4">
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">營運負責人</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>店長姓名</label>
            <input type="text" value={form.manager_name} onChange={set('manager_name')} placeholder="例：王小明" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>店長 Email</label>
            <input type="email" value={form.manager_email} onChange={set('manager_email')} placeholder="manager@example.com" className={inputCls} />
          </div>
        </div>
      </div>

      {/* 系統整合 */}
      <div className="border-t border-slate-200 pt-4">
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">系統整合</h5>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-600 mb-2">eat365 登入憑證（選填，Playwright Agent 用）</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="email" value={form.eat365_email} onChange={set('eat365_email')} placeholder="eat365 Email" className={inputCls} />
              <input type="password" value={form.eat365_password} onChange={set('eat365_password')} placeholder={submitLabel === '儲存' ? '••••••••（不修改請留空）' : 'eat365 密碼'} className={inputCls} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-2">Ocard 登入憑證（選填，Playwright Agent 用）</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="email" value={form.ocard_email} onChange={set('ocard_email')} placeholder="Ocard Email" className={inputCls} />
              <input type="password" value={form.ocard_password} onChange={set('ocard_password')} placeholder={submitLabel === '儲存' ? '••••••••（不修改請留空）' : 'Ocard 密碼'} className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? '儲存中...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors">
          取消
        </button>
      </div>
    </form>
  )
}

// ─── Store Card Component ───────────────────────────────────────────
function StoreCard({
  store, isOwner, onEdit, onToggleActive, onDelete,
}: {
  store: StoreInfo
  isOwner: boolean
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [showTargets, setShowTargets] = useState(false)
  const [targetYear, setTargetYear] = useState(new Date().getFullYear())
  const [targets, setTargets] = useState<Record<number, string>>({})
  const [annualInput, setAnnualInput] = useState('')
  const [targetLoading, setTargetLoading] = useState(false)
  const [targetSaving, setTargetSaving] = useState(false)
  const [targetMsg, setTargetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Fetch targets when expanded or year changes
  useEffect(() => {
    if (!showTargets) return
    setTargetLoading(true)
    setTargetMsg(null)
    fetch(`/api/targets?store_id=${store.id}&start_month=${targetYear}-01-01&end_month=${targetYear}-12-01`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const map: Record<number, string> = {}
          for (const row of json.data) {
            const m = new Date(row.month).getMonth()
            map[m] = String(row.revenue_target)
          }
          setTargets(map)
        } else {
          setTargets({})
        }
      })
      .catch(() => setTargets({}))
      .finally(() => setTargetLoading(false))
  }, [showTargets, targetYear, store.id])

  const handleDistribute = () => {
    const total = parseFloat(annualInput)
    if (isNaN(total) || total <= 0) return
    const monthly = Math.round(total / 12)
    const map: Record<number, string> = {}
    for (let m = 0; m < 12; m++) map[m] = String(monthly)
    setTargets(map)
  }

  const handleSaveTargets = async () => {
    setTargetSaving(true)
    setTargetMsg(null)
    const rows = []
    for (let m = 0; m < 12; m++) {
      const val = parseFloat(targets[m] || '')
      if (!isNaN(val) && val >= 0) {
        rows.push({ month: `${targetYear}-${String(m + 1).padStart(2, '0')}-01`, revenue_target: val })
      }
    }
    if (rows.length === 0) {
      setTargetMsg({ text: '請至少填入一個月的目標', type: 'error' })
      setTargetSaving(false)
      return
    }
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, targets: rows }),
      })
      const json = await res.json()
      if (json.success) {
        setTargetMsg({ text: `${targetYear} 年度目標已儲存（${rows.length} 個月）`, type: 'success' })
      } else {
        setTargetMsg({ text: `儲存失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setTargetMsg({ text: '儲存失敗', type: 'error' })
    }
    setTargetSaving(false)
  }

  const annualTotal = Object.values(targets).reduce((sum, v) => {
    const n = parseFloat(v)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  return (
    <div className={`rounded-xl border ${store.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{store.name}</p>
            {store.is_active ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                <CheckCircle size={12} /> 啟用
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                <XCircle size={12} /> 停用
              </span>
            )}
          </div>
          {isOwner && (
            <div className="flex items-center gap-1">
              <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯">
                <Edit2 size={14} />
              </button>
              <button
                onClick={onToggleActive}
                className={`p-1.5 rounded-lg transition-colors ${
                  store.is_active
                    ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                    : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                }`}
                title={store.is_active ? '停用' : '啟用'}
              >
                {store.is_active ? <PowerOff size={14} /> : <Power size={14} />}
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="刪除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600">
          {store.location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{store.location}</span>
            </div>
          )}
          {store.phone && (
            <div className="flex items-center gap-1.5">
              <Phone size={12} className="text-slate-400 shrink-0" />
              <span>{store.phone}</span>
            </div>
          )}
          {store.opened_date && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-slate-400 shrink-0" />
              <span>開業：{store.opened_date}</span>
            </div>
          )}
          {store.seat_count != null && (
            <div className="flex items-center gap-1.5">
              <Armchair size={12} className="text-slate-400 shrink-0" />
              <span>{store.seat_count} 座</span>
            </div>
          )}
          {store.manager_name && (
            <div className="flex items-center gap-1.5">
              <User size={12} className="text-slate-400 shrink-0" />
              <span>店長：{store.manager_name}</span>
            </div>
          )}
          {store.google_place_id && (
            <div className="flex items-center gap-1.5">
              <ExternalLink size={12} className="text-slate-400 shrink-0" />
              <span className="truncate font-mono text-[11px]">{store.google_place_id}</span>
            </div>
          )}
        </div>

        {/* Revenue target toggle */}
        {isOwner && store.is_active && (
          <button
            onClick={() => setShowTargets(!showTargets)}
            className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Target size={13} />
            {showTargets ? '收起營收目標' : '營收目標設定'}
          </button>
        )}
      </div>

      {/* Inline yearly targets */}
      {showTargets && (
        <div className="border-t border-slate-200 p-5 space-y-4">
          {/* Year selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTargetYear(targetYear - 1)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-900 min-w-[60px] text-center">{targetYear} 年</span>
            <button
              onClick={() => setTargetYear(targetYear + 1)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Quick distribute */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
            <span className="text-xs text-slate-600 whitespace-nowrap">年度總目標</span>
            <span className="text-xs text-slate-400">NT$</span>
            <input
              type="number"
              value={annualInput}
              onChange={(e) => setAnnualInput(e.target.value)}
              placeholder="例如 6000000"
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
            />
            <button
              onClick={handleDistribute}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              平均分配
            </button>
          </div>

          {/* Monthly grid */}
          {targetLoading ? (
            <div className="text-center text-slate-400 text-sm py-4">載入中...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {MONTH_LABELS.map((label, idx) => (
                <div key={idx}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">NT$</span>
                    <input
                      type="number"
                      value={targets[idx] || ''}
                      onChange={(e) => setTargets({ ...targets, [idx]: e.target.value })}
                      placeholder="0"
                      min="0"
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total + Save */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-600">
              年度合計：<span className="font-semibold text-slate-900">NT${annualTotal.toLocaleString()}</span>
            </p>
            <button
              onClick={handleSaveTargets}
              disabled={targetSaving}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {targetSaving ? '儲存中...' : '儲存目標'}
            </button>
          </div>

          {targetMsg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${targetMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {targetMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState<StoreFormData>({ ...emptyForm })

  // Edit state
  const [editStoreId, setEditStoreId] = useState<string | null>(null)

  // Deactivate confirmation dialog
  const [confirmStore, setConfirmStore] = useState<StoreInfo | null>(null)

  // Delete confirmation dialog
  const [deleteStore, setDeleteStore] = useState<StoreInfo | null>(null)

  // Team state
  const [currentUser, setCurrentUser] = useState<UserMe | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [teamMessage, setTeamMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Invite form state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('manager')
  const [inviteStoreId, setInviteStoreId] = useState('')
  const [inviteDisplayName, setInviteDisplayName] = useState('')
  const [inviting, setInviting] = useState(false)

  // Edit member modal state
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [editMemberRole, setEditMemberRole] = useState('')
  const [editMemberStoreId, setEditMemberStoreId] = useState('')
  const [editMemberDisplayName, setEditMemberDisplayName] = useState('')
  const [editMemberSaving, setEditMemberSaving] = useState(false)

  // Alert settings state
  const [alertEmails, setAlertEmails] = useState<string[]>([])
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [alertNewEmail, setAlertNewEmail] = useState('')
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [alertTesting, setAlertTesting] = useState(false)

  const isOwner = currentUser?.role === 'owner'

  const fetchAlertSettings = useCallback(() => {
    fetch('/api/settings/alerts')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setAlertEmails(json.data.alert_emails || [])
          setAlertEnabled(json.data.is_enabled ?? true)
        }
      })
      .catch(() => {})
  }, [])

  const fetchStores = () => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(json => {
        if (json.success) setStores(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fetchCurrentUser = () => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(json => {
        if (json.success) setCurrentUser(json.data)
      })
      .catch(() => {})
  }

  const fetchMembers = useCallback(() => {
    if (!isOwner) { setTeamLoading(false); return }
    fetch('/api/team')
      .then(r => r.json())
      .then(json => {
        if (json.success) setMembers(json.data || [])
      })
      .catch(() => {})
      .finally(() => setTeamLoading(false))
  }, [isOwner])

  useEffect(() => { fetchStores(); fetchCurrentUser(); fetchAlertSettings() }, [fetchAlertSettings])
  useEffect(() => { if (currentUser) fetchMembers() }, [currentUser, fetchMembers])

  // ── Store create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setMessage(null)

    const credentials: Record<string, Record<string, string>> = {}
    if (form.eat365_email && form.eat365_password) {
      credentials.eat365 = { email: form.eat365_email, password: form.eat365_password }
    }
    if (form.ocard_email && form.ocard_password) {
      credentials.ocard = { email: form.ocard_email, password: form.ocard_password }
    }

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim() || null,
          timezone: form.timezone,
          phone: form.phone.trim() || null,
          business_hours: form.business_hours.trim() || null,
          opened_date: form.opened_date || null,
          seat_count: form.seat_count ? parseInt(form.seat_count) : null,
          google_maps_url: form.google_maps_url.trim() || null,
          google_place_id: form.google_place_id.trim() || null,
          manager_name: form.manager_name.trim() || null,
          manager_email: form.manager_email.trim() || null,
          credentials,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ text: `門市「${form.name}」已新增`, type: 'success' })
        setShowForm(false)
        setForm({ ...emptyForm })
        fetchStores()
      } else {
        setMessage({ text: `新增失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setMessage({ text: '新增失敗', type: 'error' })
    }
    setSaving(false)
  }

  // ── Store edit ──
  const startEdit = (store: StoreInfo) => {
    setEditStoreId(store.id)
    setShowForm(false)
    setForm({
      name: store.name,
      location: store.location || '',
      timezone: store.timezone,
      phone: store.phone || '',
      business_hours: store.business_hours || '',
      opened_date: store.opened_date || '',
      seat_count: store.seat_count != null ? String(store.seat_count) : '',
      google_maps_url: store.google_maps_url || '',
      google_place_id: store.google_place_id || '',
      manager_name: store.manager_name || '',
      manager_email: store.manager_email || '',
      eat365_email: '',
      eat365_password: '',
      ocard_email: '',
      ocard_password: '',
    })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editStoreId || !form.name.trim()) return
    setSaving(true)
    setMessage(null)

    const credentials: Record<string, Record<string, string>> = {}
    if (form.eat365_email || form.eat365_password) {
      credentials.eat365 = {}
      if (form.eat365_email) credentials.eat365.email = form.eat365_email
      if (form.eat365_password) credentials.eat365.password = form.eat365_password
    }
    if (form.ocard_email || form.ocard_password) {
      credentials.ocard = {}
      if (form.ocard_email) credentials.ocard.email = form.ocard_email
      if (form.ocard_password) credentials.ocard.password = form.ocard_password
    }

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        timezone: form.timezone,
        phone: form.phone.trim() || null,
        business_hours: form.business_hours.trim() || null,
        opened_date: form.opened_date || null,
        seat_count: form.seat_count ? parseInt(form.seat_count) : null,
        google_maps_url: form.google_maps_url.trim() || null,
        google_place_id: form.google_place_id.trim() || null,
        manager_name: form.manager_name.trim() || null,
        manager_email: form.manager_email.trim() || null,
      }
      if (Object.keys(credentials).length > 0) {
        body.credentials = credentials
      }

      const res = await fetch(`/api/stores/${editStoreId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ text: `門市「${form.name}」已更新`, type: 'success' })
        setEditStoreId(null)
        setForm({ ...emptyForm })
        fetchStores()
      } else {
        setMessage({ text: `更新失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setMessage({ text: '更新失敗', type: 'error' })
    }
    setSaving(false)
  }

  const cancelEdit = () => {
    setEditStoreId(null)
    setForm({ ...emptyForm })
  }

  // ── Store toggle active ──
  const handleToggleActive = async (store: StoreInfo) => {
    if (store.is_active) {
      // Show confirmation dialog for deactivation
      setConfirmStore(store)
      return
    }
    // Direct activation — no dialog
    await doToggle(store.id)
  }

  const doToggle = async (storeId: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/stores/${storeId}/toggle-active`, { method: 'PUT' })
      const json = await res.json()
      if (json.success) {
        const action = json.data.is_active ? '啟用' : '停用'
        setMessage({ text: `已${action}「${json.data.name}」`, type: 'success' })
        fetchStores()
      } else {
        setMessage({ text: `操作失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setMessage({ text: '操作失敗', type: 'error' })
    }
    setConfirmStore(null)
  }

  // ── Store delete ──
  const doDelete = async (storeId: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/stores/${storeId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setMessage({ text: `已刪除門市`, type: 'success' })
        fetchStores()
      } else {
        setMessage({ text: `刪除失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setMessage({ text: '刪除失敗', type: 'error' })
    }
    setDeleteStore(null)
  }

  // ── Team handlers ──
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setTeamMessage(null)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          store_id: inviteRole === 'manager' ? inviteStoreId : null,
          display_name: inviteDisplayName.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setTeamMessage({ text: `已發送邀請信至 ${inviteEmail}`, type: 'success' })
        setShowInvite(false)
        setInviteEmail(''); setInviteRole('manager'); setInviteStoreId(''); setInviteDisplayName('')
        fetchMembers()
      } else {
        setTeamMessage({ text: `邀請失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setTeamMessage({ text: '邀請失敗', type: 'error' })
    }
    setInviting(false)
  }

  const handleEditMemberSave = async () => {
    if (!editMember) return
    setEditMemberSaving(true)
    setTeamMessage(null)
    try {
      const res = await fetch(`/api/team/${editMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editMemberRole,
          store_id: editMemberRole === 'manager' ? editMemberStoreId : null,
          display_name: editMemberDisplayName.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setTeamMessage({ text: `已更新 ${editMember.email} 的資料`, type: 'success' })
        setEditMember(null)
        fetchMembers()
      } else {
        setTeamMessage({ text: `更新失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setTeamMessage({ text: '更新失敗', type: 'error' })
    }
    setEditMemberSaving(false)
  }

  const handleToggleMemberActive = async (member: TeamMember) => {
    const action = member.is_active ? 'disable' : 'enable'
    const confirmMsg = member.is_active
      ? `確定要停用 ${member.email} 的帳號？停用後該成員將無法登入。`
      : `確定要重新啟用 ${member.email} 的帳號？`
    if (!window.confirm(confirmMsg)) return
    setTeamMessage(null)
    try {
      const res = await fetch(`/api/team/${member.id}/${action}`, { method: 'PUT' })
      const json = await res.json()
      if (json.success) {
        setTeamMessage({
          text: member.is_active ? `已停用 ${member.email}` : `已重新啟用 ${member.email}`,
          type: 'success',
        })
        fetchMembers()
      } else {
        setTeamMessage({ text: `操作失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setTeamMessage({ text: '操作失敗', type: 'error' })
    }
  }

  const handleDeleteMember = async (member: TeamMember) => {
    if (!window.confirm(`確定要刪除 ${member.display_name || member.email} 的帳號？此操作無法復原。`)) return
    setTeamMessage(null)
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setTeamMessage({ text: `已刪除 ${member.email}`, type: 'success' })
        fetchMembers()
      } else {
        setTeamMessage({ text: `刪除失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setTeamMessage({ text: '刪除失敗', type: 'error' })
    }
  }

  const openEditMember = (member: TeamMember) => {
    setEditMember(member)
    setEditMemberRole(member.role)
    setEditMemberStoreId(member.store_id || '')
    setEditMemberDisplayName(member.display_name || member.name || '')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-slate-600" />
        <h3 className="text-base font-semibold text-slate-900">系統設定</h3>
      </div>

      {/* Store Management */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900">門市管理</h4>
          </div>
          {isOwner && (
            <button
              onClick={() => { setShowForm(!showForm); setEditStoreId(null); setForm({ ...emptyForm }) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              新增門市
            </button>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-5 mt-3 text-sm px-4 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Add store form */}
        {showForm && !editStoreId && (
          <div className="p-5 border-b border-slate-200">
            <StoreForm
              form={form}
              onChange={setForm}
              onSubmit={handleCreate}
              onCancel={() => { setShowForm(false); setForm({ ...emptyForm }) }}
              saving={saving}
              submitLabel="新增門市"
            />
          </div>
        )}

        {/* Store list */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
        ) : stores.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">尚無門市</div>
        ) : (
          <div className="p-4 space-y-3">
            {stores.map(store => (
              <div key={store.id}>
                {editStoreId === store.id ? (
                  <div className="p-5 rounded-xl border-2 border-blue-300 bg-blue-50/30">
                    <h5 className="text-sm font-semibold text-slate-900 mb-4">編輯門市 — {store.name}</h5>
                    <StoreForm
                      form={form}
                      onChange={setForm}
                      onSubmit={handleEdit}
                      onCancel={cancelEdit}
                      saving={saving}
                      submitLabel="儲存"
                    />
                  </div>
                ) : (
                  <StoreCard
                    store={store}
                    isOwner={isOwner}
                    onEdit={() => startEdit(store)}
                    onToggleActive={() => handleToggleActive(store)}
                    onDelete={() => setDeleteStore(store)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deactivation Confirmation Dialog */}
      {confirmStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">確認停用門市</h4>
            <p className="text-sm text-slate-600">
              停用後該門市的歷史數據仍會保留，Playwright Agent 將不再為此門市下載報表。
              確定要停用「{confirmStore.name}」嗎？
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => doToggle(confirmStore.id)}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                確定停用
              </button>
              <button
                onClick={() => setConfirmStore(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-sm font-semibold text-red-600">確認刪除門市</h4>
            <p className="text-sm text-slate-600">
              刪除後該門市的所有歷史數據將會一併移除，此操作無法復原。確定要刪除「{deleteStore.name}」嗎？
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => doDelete(deleteStore.id)}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                確定刪除
              </button>
              <button
                onClick={() => setDeleteStore(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Notification Settings */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-red-500" />
            <h4 className="text-sm font-semibold text-slate-900">警報通知設定</h4>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-500">{alertEnabled ? '啟用' : '停用'}</span>
            <button
              type="button"
              onClick={async () => {
                const newVal = !alertEnabled
                setAlertEnabled(newVal)
                setAlertSaving(true)
                try {
                  await fetch('/api/settings/alerts', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alert_emails: alertEmails, is_enabled: newVal }),
                  })
                } catch {}
                setAlertSaving(false)
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${alertEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${alertEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">偵測到異常時，系統會發送 Email 通知給以下收件人。</p>

          {/* Email list */}
          <div className="space-y-2">
            {alertEmails.map((email, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <Mail size={14} className="text-slate-400" />
                <span className="text-sm text-slate-700 flex-1">{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = alertEmails.filter((_, idx) => idx !== i)
                    setAlertEmails(updated)
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add email */}
          <div className="flex gap-2">
            <input
              type="email"
              value={alertNewEmail}
              onChange={(e) => setAlertNewEmail(e.target.value)}
              placeholder="輸入 Email 地址"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (alertNewEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertNewEmail.trim())) {
                    if (!alertEmails.includes(alertNewEmail.trim())) {
                      setAlertEmails([...alertEmails, alertNewEmail.trim()])
                    }
                    setAlertNewEmail('')
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (alertNewEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertNewEmail.trim())) {
                  if (!alertEmails.includes(alertNewEmail.trim())) {
                    setAlertEmails([...alertEmails, alertNewEmail.trim()])
                  }
                  setAlertNewEmail('')
                }
              }}
              className="px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors"
            >
              新增
            </button>
          </div>

          {/* Save + Test buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                setAlertSaving(true)
                setAlertMsg(null)
                try {
                  const res = await fetch('/api/settings/alerts', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alert_emails: alertEmails, is_enabled: alertEnabled }),
                  })
                  const json = await res.json()
                  setAlertMsg(json.success
                    ? { text: '已儲存', type: 'success' }
                    : { text: `儲存失敗：${json.error}`, type: 'error' })
                } catch {
                  setAlertMsg({ text: '儲存失敗', type: 'error' })
                }
                setAlertSaving(false)
              }}
              disabled={alertSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {alertSaving ? '儲存中...' : '儲存設定'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (alertEmails.length === 0) {
                  setAlertMsg({ text: '請先新增至少一個 Email', type: 'error' })
                  return
                }
                // Save first, then test
                setAlertTesting(true)
                setAlertMsg(null)
                try {
                  await fetch('/api/settings/alerts', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alert_emails: alertEmails, is_enabled: alertEnabled }),
                  })
                  const res = await fetch('/api/alerts/test', { method: 'POST' })
                  const json = await res.json()
                  setAlertMsg(json.success
                    ? { text: '測試 Email 已送出', type: 'success' }
                    : { text: `發送失敗：${json.error}`, type: 'error' })
                } catch {
                  setAlertMsg({ text: '發送失敗', type: 'error' })
                }
                setAlertTesting(false)
              }}
              disabled={alertTesting}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              {alertTesting ? '傳送中...' : '測試發送'}
            </button>
          </div>

          {alertMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              alertMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {alertMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Weather Data Management */}
      <WeatherSettingsPanel />

      {/* Team Management — Owner only */}
      {isOwner && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-500" />
              <h4 className="text-sm font-semibold text-slate-900">團隊成員</h4>
            </div>
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={14} />
              邀請成員
            </button>
          </div>

          {teamMessage && (
            <div className={`mx-5 mt-3 text-sm px-4 py-2 rounded-lg ${teamMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {teamMessage.text}
            </div>
          )}

          {/* Invite form */}
          {showInvite && (
            <form onSubmit={handleInvite} className="p-5 border-b border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="member@example.com" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">顯示名稱</label>
                  <input type="text" value={inviteDisplayName} onChange={e => setInviteDisplayName(e.target.value)} placeholder="例：王小明" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">角色 *</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                    <option value="marketing">Marketing</option>
                    <option value="investor">Investor</option>
                  </select>
                </div>
                {inviteRole === 'manager' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">綁定分店 *</label>
                    <select value={inviteStoreId} onChange={e => setInviteStoreId(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">選擇分店</option>
                      {stores.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield size={14} className="text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">角色說明</span>
                </div>
                {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                  <div key={role} className="flex items-start gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                    <span className="text-slate-600 pt-0.5">{desc}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={inviting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {inviting ? '發送中...' : '發送邀請'}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors">
                  取消
                </button>
              </div>
            </form>
          )}

          {/* Member list */}
          {teamLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">尚無團隊成員</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map(member => (
                <div key={member.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {member.display_name || member.name || member.email}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.role] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_LABELS[member.role] || member.role}
                        </span>
                        {!member.is_active && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">已停用</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{member.email}</span>
                        {member.store_name && <span>| {member.store_name}</span>}
                        <span>| {new Date(member.created_at).toLocaleDateString('zh-TW')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button onClick={() => openEditMember(member)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯角色">
                        <Edit2 size={14} />
                      </button>
                      {member.role !== 'owner' || members.filter(m => m.role === 'owner' && m.is_active).length > 1 ? (
                        <>
                          <button
                            onClick={() => handleToggleMemberActive(member)}
                            className={`p-1.5 rounded-lg transition-colors ${member.is_active ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                            title={member.is_active ? '停用帳號' : '重新啟用'}
                          >
                            {member.is_active ? <Ban size={14} /> : <RotateCcw size={14} />}
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="刪除成員"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit Member Modal */}
          {editMember && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">編輯成員 — {editMember.email}</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">顯示名稱</label>
                  <input type="text" value={editMemberDisplayName} onChange={e => setEditMemberDisplayName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">角色</label>
                  <select value={editMemberRole} onChange={e => setEditMemberRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                    <option value="marketing">Marketing</option>
                    <option value="investor">Investor</option>
                  </select>
                </div>
                {editMemberRole === 'manager' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">綁定分店 *</label>
                    <select value={editMemberStoreId} onChange={e => setEditMemberStoreId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">選擇分店</option>
                      {stores.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={handleEditMemberSave} disabled={editMemberSaving || (editMemberRole === 'manager' && !editMemberStoreId)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {editMemberSaving ? '儲存中...' : '儲存'}
                  </button>
                  <button onClick={() => setEditMember(null)} className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors">
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
