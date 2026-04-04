'use client'

import { useEffect, useState } from 'react'
import { Bell, Mail, AlertTriangle, TrendingDown, Users, Truck, DollarSign } from 'lucide-react'
import { format } from 'date-fns'

interface Alert {
  id: string
  store_id: string
  alert_type: string
  severity: string
  metric_value: number | null
  threshold_value: number | null
  message: string
  notified_at: string | null
  created_at: string
}

const alertTypeConfig: Record<string, { label: string; icon: typeof TrendingDown; color: string }> = {
  revenue_drop: { label: '營收下降', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
  cost_spike: { label: '成本異常', icon: DollarSign, color: 'text-orange-600 bg-orange-50' },
  member_churn: { label: '會員流失', icon: Users, color: 'text-amber-600 bg-amber-50' },
  delivery_drop: { label: '外送下降', icon: Truck, color: 'text-purple-600 bg-purple-50' },
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/alerts?days=30')
      .then(r => r.json())
      .then(json => {
        if (json.success) setAlerts(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleTestNotification = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/alerts/test', { method: 'POST' })
      const json = await res.json()
      setTestResult(json.success ? 'Email 測試通知已送出' : `失敗：${json.error}`)
    } catch {
      setTestResult('發送失敗')
    }
    setTesting(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-red-600" />
          <h3 className="text-base font-semibold text-slate-900">異常警報</h3>
        </div>
        <button
          onClick={handleTestNotification}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Mail size={14} />
          {testing ? '傳送中...' : '測試 Email 通知'}
        </button>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`text-sm px-4 py-2 rounded-lg ${testResult.includes('已送出') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult}
        </div>
      )}

      {/* Alert summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(alertTypeConfig).map(([type, config]) => {
          const count = alerts.filter(a => a.alert_type === type).length
          const Icon = config.icon
          return (
            <div key={type} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={config.color.split(' ')[0]} />
                <p className="text-xs text-slate-500">{config.label}</p>
              </div>
              <p className="text-lg font-semibold text-slate-900">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Alert list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">近 30 天警報紀錄</h4>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <AlertTriangle size={24} className="mx-auto mb-2 text-slate-300" />
            近 30 天無異常警報
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map(alert => {
              const config = alertTypeConfig[alert.alert_type] || alertTypeConfig.revenue_drop
              const Icon = config.icon
              return (
                <div key={alert.id} className="px-5 py-4 flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.severity === 'critical' ? '嚴重' : '警告'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(alert.created_at), 'yyyy/M/d HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900">{alert.message}</p>
                    {alert.notified_at && (
                      <p className="text-xs text-slate-400 mt-1">
                        Email 通知已送出：{format(new Date(alert.notified_at), 'HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
