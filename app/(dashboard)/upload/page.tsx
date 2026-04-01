'use client'

import { useEffect, useState } from 'react'
import { CsvDropzone } from '@/components/upload/CsvDropzone'
import { format } from 'date-fns'

interface UploadRecord {
  id: string
  file_name: string
  file_type: string
  record_count: number
  status: string
  created_at: string
}

export default function UploadPage() {
  const [history, setHistory] = useState<UploadRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = () => {
    fetch('/api/upload/history')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHistory(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const statusColors: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-800',
    partial: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">上傳報表</h3>
        <CsvDropzone />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">上傳紀錄</h3>
          <button
            onClick={fetchHistory}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            重新整理
          </button>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 text-sm py-8">載入中...</div>
        ) : history.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">尚無上傳紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">檔案名稱</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium hidden sm:table-cell">類型</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">筆數</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">狀態</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium hidden md:table-cell">時間</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 px-2 text-slate-900 truncate max-w-[200px]">{r.file_name}</td>
                    <td className="py-2 px-2 text-slate-500 hidden sm:table-cell">{r.file_type}</td>
                    <td className="py-2 px-2 text-right text-slate-700">{r.record_count}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400 text-xs hidden md:table-cell">
                      {format(new Date(r.created_at), 'yyyy/M/d HH:mm')}
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
