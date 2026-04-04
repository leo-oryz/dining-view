'use client'

import { useState } from 'react'
import { Send, FileText } from 'lucide-react'

interface Props {
  mode: 'send' | 'record'
  onCreated: () => void
}

export default function BroadcastForm({ mode, onCreated }: Props) {
  const [form, setForm] = useState({
    broadcast_date: '',
    title: '',
    message: '',
    target_audience: '',
    friend_count_before: '',
    friend_count_after: '',
    delivered: '',
    opened: '',
    clicked: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'send' && !confirmSend) {
      setConfirmSend(true)
      return
    }

    setSubmitting(true)
    setConfirmSend(false)

    try {
      if (mode === 'send') {
        const res = await fetch('/api/line/broadcast-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, message: form.message }),
        })
        const json = await res.json()
        if (json.success) {
          setForm({
            broadcast_date: '', title: '', message: '', target_audience: '',
            friend_count_before: '', friend_count_after: '', delivered: '', opened: '', clicked: '',
          })
          onCreated()
        }
      } else {
        const res = await fetch('/api/line/broadcasts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            friend_count_before: form.friend_count_before ? Number(form.friend_count_before) : null,
            friend_count_after: form.friend_count_after ? Number(form.friend_count_after) : null,
            delivered: form.delivered ? Number(form.delivered) : null,
            opened: form.opened ? Number(form.opened) : null,
            clicked: form.clicked ? Number(form.clicked) : null,
          }),
        })
        const json = await res.json()
        if (json.success) {
          setForm({
            broadcast_date: '', title: '', message: '', target_audience: '',
            friend_count_before: '', friend_count_after: '', delivered: '', opened: '', clicked: '',
          })
          onCreated()
        }
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'send') {
    return (
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-green-200 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Send size={16} className="text-green-600" />
          <span className="text-sm font-semibold text-green-700">發送推播給所有好友</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">標題 *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="推播標題（僅供內部紀錄）"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">訊息內容 *</label>
          <textarea
            required
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            placeholder="輸入要發送給所��好友的訊息..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-slate-400 mt-1">此訊息將發送給 LINE OA 的所有好友</p>
        </div>

        {confirmSend && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800 font-medium">確定要發送推播嗎？</p>
            <p className="text-xs text-amber-600 mt-1">此訊息將發送給所有 LINE OA 好友，無法撤回。</p>
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {submitting ? '發送中...' : '確認發送'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSend(false)}
                className="px-4 py-1.5 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {!confirmSend && (
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            發送推播
          </button>
        )}
      </form>
    )
  }

  // Record mode
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={16} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-600">手動新增歷史紀錄</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">推播日期 *</label>
          <input
            type="date"
            required
            value={form.broadcast_date}
            onChange={(e) => setForm({ ...form, broadcast_date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">標題 *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">目標受眾</label>
          <input
            type="text"
            value={form.target_audience}
            onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
            placeholder="e.g. 全部好友、VIP"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">推播前好友數</label>
          <input
            type="number"
            value={form.friend_count_before}
            onChange={(e) => setForm({ ...form, friend_count_before: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">推播後好友數</label>
          <input
            type="number"
            value={form.friend_count_after}
            onChange={(e) => setForm({ ...form, friend_count_after: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">送達數</label>
          <input
            type="number"
            value={form.delivered}
            onChange={(e) => setForm({ ...form, delivered: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">開封數</label>
          <input
            type="number"
            value={form.opened}
            onChange={(e) => setForm({ ...form, opened: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">點擊數</label>
          <input
            type="number"
            value={form.clicked}
            onChange={(e) => setForm({ ...form, clicked: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">訊息內容</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {submitting ? '建立中...' : '新增推播紀錄'}
      </button>
    </form>
  )
}
