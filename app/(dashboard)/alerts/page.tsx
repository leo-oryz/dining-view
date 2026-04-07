'use client'

import { useEffect, useState, useMemo } from 'react'
import { Bell, Mail, AlertTriangle, TrendingDown, Users, Truck, DollarSign } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { type WeatherDaily, getWeatherType, getWeatherIcon, WEATHER_LABELS, isTyphoon, buildWeatherMap } from '@/lib/weather/weatherUtils'
import { useI18n } from '@/lib/i18n/context'

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

export default function AlertsPage() {
  const { t } = useI18n()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherDaily>>(new Map())
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)

  const alertTypeConfig = useMemo(() => ({
    revenue_drop: { label: t('alerts.revenueDown'), icon: TrendingDown, color: 'text-red-600 bg-red-50' },
    cost_spike: { label: t('alerts.costAnomaly'), icon: DollarSign, color: 'text-orange-600 bg-orange-50' },
    member_churn: { label: t('alerts.memberLoss'), icon: Users, color: 'text-amber-600 bg-amber-50' },
    delivery_drop: { label: t('alerts.deliveryDown'), icon: Truck, color: 'text-purple-600 bg-purple-50' },
  }), [t])

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const from = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    Promise.all([
      fetch('/api/alerts?days=30').then(r => r.json()),
      fetch(`/api/weather/range?from=${from}&to=${today}`).then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([alertsJson, weatherJson]) => {
        if (alertsJson.success) setAlerts(alertsJson.data || [])
        if (weatherJson.success) setWeatherMap(buildWeatherMap(weatherJson.data || []))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDetect = async () => {
    setDetecting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/alerts/detect', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setTestResult(`${t('alerts.detectDonePrefix')} ${json.data.detected} ${t('alerts.detectDoneSuffix')}`)
        // Reload alerts
        const alertsRes = await fetch('/api/alerts?days=30')
        const alertsJson = await alertsRes.json()
        if (alertsJson.success) setAlerts(alertsJson.data || [])
      } else {
        setTestResult(`${t('alerts.detectFailed')}${json.error ? `：${json.error}` : ''}`)
      }
    } catch {
      setTestResult(t('alerts.detectFailed'))
    }
    setDetecting(false)
  }

  const handleTestNotification = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/alerts/test', { method: 'POST' })
      const json = await res.json()
      setTestResult(json.success ? t('alerts.emailTestSent') : `${t('alerts.sendFailed')}${json.error ? `：${json.error}` : ''}`)
    } catch {
      setTestResult(t('alerts.sendFailed'))
    }
    setTesting(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-red-600" />
          <h3 className="text-base font-semibold text-slate-900">{t('alerts.title')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <AlertTriangle size={14} />
            {detecting ? t('alerts.detecting') : t('alerts.detectNow')}
          </button>
          <button
            onClick={handleTestNotification}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Mail size={14} />
            {testing ? t('alerts.sending') : t('alerts.testEmail')}
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`text-sm px-4 py-2 rounded-lg ${testResult.includes(t('alerts.emailTestSent')) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
          <h4 className="text-sm font-semibold text-slate-900">{t('alerts.recentAlerts')}</h4>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <AlertTriangle size={24} className="mx-auto mb-2 text-slate-300" />
            {t('alerts.noAlerts')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map(alert => {
              const config = alertTypeConfig[alert.alert_type as keyof typeof alertTypeConfig] || alertTypeConfig.revenue_drop
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
                        {alert.severity === 'critical' ? t('alerts.severe') : t('alerts.warning')}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(alert.created_at), 'yyyy/M/d HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900">{alert.message}</p>
                    {(() => {
                      const alertDate = alert.created_at.slice(0, 10)
                      const w = weatherMap.get(alertDate)
                      if (!w) return null
                      const type = getWeatherType(w)
                      const isTyphoonDay = isTyphoon(w)
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">
                            {alertDate}  {getWeatherIcon(type)} {WEATHER_LABELS[type]}
                            {w.temp_high != null ? ` ${t('alerts.highest')} ${w.temp_high}°C` : ''}
                          </span>
                          {isTyphoonDay && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                              {t('alerts.typhoonDay')}
                            </span>
                          )}
                          {isTyphoonDay && (
                            <span className="text-xs text-slate-400">{t('alerts.typhoonDisclaimer')}</span>
                          )}
                        </div>
                      )
                    })()}
                    {alert.notified_at && (
                      <p className="text-xs text-slate-400 mt-1">
                        {t('alerts.emailSent')}：{format(new Date(alert.notified_at), 'HH:mm')}
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
