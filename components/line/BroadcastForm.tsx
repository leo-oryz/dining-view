'use client'

import { useState } from 'react'

interface Props {
  onCreated: () => void
}

export default function BroadcastForm({ onCreated }: Props) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
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
