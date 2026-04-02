'use client'

import { useEffect, useState } from 'react'
import { Settings, Plus, Store, CheckCircle, XCircle } from 'lucide-react'

interface StoreInfo {
  id: string
  name: string
  location: string | null
  timezone: string
  is_active: boolean
  created_at: string
}

export default function SettingsPage() {
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formTimezone, setFormTimezone] = useState('Asia/Taipei')
  const [formEat365Email, setFormEat365Email] = useState('')
  const [formEat365Password, setFormEat365Password] = useState('')
  const [formOcardEmail, setFormOcardEmail] = useState('')
  const [formOcardPassword, setFormOcardPassword] = useState('')

  const fetchStores = () => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(json => {
        if (json.success) setStores(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStores() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    setSaving(true)
    setMessage(null)

    try {
      const credentials: Record<string, Record<string, string>> = {}
      if (formEat365Email && formEat365Password) {
        credentials.eat365 = { email: formEat365Email, password: formEat365Password }
      }
      if (formOcardEmail && formOcardPassword) {
        credentials.ocard = { email: formOcardEmail, password: formOcardPassword }
      }

      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          location: formLocation.trim() || null,
          timezone: formTimezone,
          credentials,
        }),
      })
      const json = await res.json()

      if (json.success) {
        setMessage(`門市「${formName}」已新增`)
        setShowForm(false)
        setFormName('')
        setFormLocation('')
        setFormEat365Email('')
        setFormEat365Password('')
        setFormOcardEmail('')
        setFormOcardPassword('')
        fetchStores()
      } else {
        setMessage(`新增失敗：${json.error}`)
      }
    } catch {
      setMessage('新增失敗')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-slate-600" />
          <h3 className="text-base font-semibold text-slate-900">系統設定</h3>
        </div>
      </div>

      {/* Store Management */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900">門市管理</h4>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            新增門市
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-5 mt-3 text-sm px-4 py-2 rounded-lg ${message.includes('已新增') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {/* Add store form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="p-5 border-b border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">門市名稱 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="例：BE& 信義"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">地址</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="例：台北市信義區..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">時區</label>
              <select
                value={formTimezone}
                onChange={e => setFormTimezone(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                <option value="Asia/Hong_Kong">Asia/Hong_Kong (UTC+8)</option>
              </select>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-700 mb-3">eat365 登入憑證（可選）</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  value={formEat365Email}
                  onChange={e => setFormEat365Email(e.target.value)}
                  placeholder="eat365 Email"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  value={formEat365Password}
                  onChange={e => setFormEat365Password(e.target.value)}
                  placeholder="eat365 密碼"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-700 mb-3">Ocard 登入憑證（可選）</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  value={formOcardEmail}
                  onChange={e => setFormOcardEmail(e.target.value)}
                  placeholder="Ocard Email"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  value={formOcardPassword}
                  onChange={e => setFormOcardPassword(e.target.value)}
                  placeholder="Ocard 密碼"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? '儲存中...' : '新增門市'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {/* Store list */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
        ) : stores.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">尚無門市</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stores.map(store => (
              <div key={store.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{store.name}</p>
                    {store.is_active ? (
                      <CheckCircle size={14} className="text-green-500" />
                    ) : (
                      <XCircle size={14} className="text-slate-400" />
                    )}
                  </div>
                  {store.location && (
                    <p className="text-xs text-slate-500 mt-0.5">{store.location}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400">{store.timezone}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
