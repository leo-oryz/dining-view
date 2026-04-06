'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { MessageSquare, FileText } from 'lucide-react'
import BroadcastForm from '@/components/line/BroadcastForm'
import FriendTrendChart from '@/components/line/FriendTrendChart'
import BroadcastImpactChart from '@/components/line/BroadcastImpactChart'

interface Broadcast {
  id: string
  broadcast_date: string
  title: string
  message: string | null
  target_audience: string | null
  friend_count_before: number | null
  friend_count_after: number | null
  delivered: number | null
  opened: number | null
  clicked: number | null
  created_at: string
}

interface ImpactRow {
  broadcast_title: string
  broadcast_date: string
  avg_before: number
  d1_revenue: number | null
  d2_revenue: number | null
  d3_revenue: number | null
}

export default function LinePage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [friendTrend, setFriendTrend] = useState<{ broadcast_date: string; friend_count_after: number | null }[]>([])
  const [impact, setImpact] = useState<ImpactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchData = async () => {
    try {
      const [bRes, ftRes, impRes] = await Promise.all([
        fetch('/api/line/broadcasts'),
        fetch('/api/line/friend-trend'),
        fetch('/api/line/broadcast-impact'),
      ])
      const [bJson, ftJson, impJson] = await Promise.all([
        bRes.json(), ftRes.json(), impRes.json(),
      ])
      if (bJson.success) setBroadcasts(bJson.data || [])
      if (ftJson.success) setFriendTrend(ftJson.data || [])
      if (impJson.success) setImpact(impJson.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filter out auto-synced follower snapshots from the table display
  const displayBroadcasts = broadcasts.filter(b => b.title !== '__follower_snapshot__')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-green-600" />
          <h3 className="text-base font-semibold text-slate-900">LINE 推播成效追蹤</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
            showForm
              ? 'bg-slate-200 text-slate-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          <FileText size={14} />
          {showForm ? '取消' : '新增紀錄'}
        </button>
      </div>

      {/* Auto-sync notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-xs text-green-700">
        好友數與推播送達數每日自動從 LINE OA 同步。你只需在推播後補上標題即可。
      </div>

      {/* Form */}
      {showForm && <BroadcastForm onCreated={() => { setShowForm(false); fetchData() }} />}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">好友數趨勢</h4>
          <FriendTrendChart data={friendTrend} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">推播營收效果 (D+1 ~ D+3)</h4>
          <BroadcastImpactChart data={impact} />
        </div>
      </div>

      {/* Broadcast list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">推播紀錄</h4>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
        ) : displayBroadcasts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">尚無推播紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">日期</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">標題</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">送達</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">開封</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">點擊</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">好友數</th>
                </tr>
              </thead>
              <tbody>
                {displayBroadcasts.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500">
                      {format(new Date(b.broadcast_date), 'yyyy/M/d')}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{b.title}</td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {b.delivered?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {b.opened?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {b.clicked?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">
                      {b.friend_count_after?.toLocaleString() ?? '-'}
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
