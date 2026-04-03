'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings, Plus, Store, CheckCircle, XCircle, Users, UserPlus, Shield, Edit2, Ban, RotateCcw } from 'lucide-react'

interface StoreInfo {
  id: string
  name: string
  location: string | null
  timezone: string
  is_active: boolean
  created_at: string
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  marketing: 'Marketing',
  investor: 'Investor',
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

export default function SettingsPage() {
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Store form state
  const [formName, setFormName] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formTimezone, setFormTimezone] = useState('Asia/Taipei')
  const [formEat365Email, setFormEat365Email] = useState('')
  const [formEat365Password, setFormEat365Password] = useState('')
  const [formOcardEmail, setFormOcardEmail] = useState('')
  const [formOcardPassword, setFormOcardPassword] = useState('')

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

  // Edit modal state
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editStoreId, setEditStoreId] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const isOwner = currentUser?.role === 'owner'

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
    if (!isOwner) {
      setTeamLoading(false)
      return
    }
    fetch('/api/team')
      .then(r => r.json())
      .then(json => {
        if (json.success) setMembers(json.data || [])
      })
      .catch(() => {})
      .finally(() => setTeamLoading(false))
  }, [isOwner])

  useEffect(() => {
    fetchStores()
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) fetchMembers()
  }, [currentUser, fetchMembers])

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
        setInviteEmail('')
        setInviteRole('manager')
        setInviteStoreId('')
        setInviteDisplayName('')
        fetchMembers()
      } else {
        setTeamMessage({ text: `邀請失敗：${json.error}`, type: 'error' })
      }
    } catch {
      setTeamMessage({ text: '邀請失敗', type: 'error' })
    }
    setInviting(false)
  }

  const handleEditSave = async () => {
    if (!editMember) return
    setEditSaving(true)
    setTeamMessage(null)

    try {
      const res = await fetch(`/api/team/${editMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          store_id: editRole === 'manager' ? editStoreId : null,
          display_name: editDisplayName.trim() || null,
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
    setEditSaving(false)
  }

  const handleToggleActive = async (member: TeamMember) => {
    const action = member.is_active ? 'disable' : 'enable'
    const confirmMsg = member.is_active
      ? `確定要停用 ${member.email} 的帳號？停用後該成員將無法登入。`
      : `確定要重新啟用 ${member.email} 的帳號？`

    if (!window.confirm(confirmMsg)) return

    setTeamMessage(null)

    try {
      const res = await fetch(`/api/team/${member.id}/${action}`, {
        method: 'PUT',
      })
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

  const openEdit = (member: TeamMember) => {
    setEditMember(member)
    setEditRole(member.role)
    setEditStoreId(member.store_id || '')
    setEditDisplayName(member.display_name || member.name || '')
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

          {/* Team message */}
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
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">顯示名稱</label>
                  <input
                    type="text"
                    value={inviteDisplayName}
                    onChange={e => setInviteDisplayName(e.target.value)}
                    placeholder="例：王小明"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">角色 *</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                    <option value="marketing">Marketing</option>
                    <option value="investor">Investor</option>
                  </select>
                </div>
                {inviteRole === 'manager' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">綁定分店 *</label>
                    <select
                      value={inviteStoreId}
                      onChange={e => setInviteStoreId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">選擇分店</option>
                      {stores.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Role descriptions */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield size={14} className="text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">角色說明</span>
                </div>
                {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                  <div key={role} className="flex items-start gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                    <span className="text-slate-600 pt-0.5">{desc}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {inviting ? '發送中...' : '發送邀請'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                >
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
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            已停用
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{member.email}</span>
                        {member.store_name && <span>| {member.store_name}</span>}
                        <span>| {new Date(member.created_at).toLocaleDateString('zh-TW')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="編輯角色"
                      >
                        <Edit2 size={14} />
                      </button>
                      {member.role !== 'owner' || members.filter(m => m.role === 'owner' && m.is_active).length > 1 ? (
                        <button
                          onClick={() => handleToggleActive(member)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            member.is_active
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={member.is_active ? '停用帳號' : '重新啟用'}
                        >
                          {member.is_active ? <Ban size={14} /> : <RotateCcw size={14} />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit Modal */}
          {editMember && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  編輯成員 — {editMember.email}
                </h4>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">顯示名稱</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={e => setEditDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">角色</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                    <option value="marketing">Marketing</option>
                    <option value="investor">Investor</option>
                  </select>
                </div>

                {editRole === 'manager' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">綁定分店 *</label>
                    <select
                      value={editStoreId}
                      onChange={e => setEditStoreId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">選擇分店</option>
                      {stores.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving || (editRole === 'manager' && !editStoreId)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {editSaving ? '儲存中...' : '儲存'}
                  </button>
                  <button
                    onClick={() => setEditMember(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                  >
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
