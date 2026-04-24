'use client'

import { useEffect, useState } from 'react'
import { Brain, Loader2 } from 'lucide-react'

type Config = {
  business_context: string | null
  labor_target_cost_ratio: number
  labor_pt_healthy_min: number
  labor_pt_healthy_max: number
  labor_ot_monthly_cap: number
  labor_ot_quarterly_cap: number
  labor_ft_low_threshold: number
  labor_pt_high_threshold: number
}

const DEFAULTS: Config = {
  business_context: '',
  labor_target_cost_ratio: 0.30,
  labor_pt_healthy_min: 0.30,
  labor_pt_healthy_max: 0.40,
  labor_ot_monthly_cap: 46,
  labor_ot_quarterly_cap: 138,
  labor_ft_low_threshold: 140,
  labor_pt_high_threshold: 80,
}

const labelCls = 'block text-xs font-medium text-slate-700 mb-1'
const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function AiConfigPanel({ isOwner }: { isOwner: boolean }) {
  const [form, setForm] = useState<Config>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai/config')
      .then(r => r.json())
      .then(j => {
        if (j.success) setForm({ ...DEFAULTS, ...j.data })
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [])

  if (!isOwner) return null

  const pctStr = (v: number) => (v * 100).toFixed(0)
  const setPct = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value)
    if (!isFinite(n)) return
    setForm(f => ({ ...f, [k]: Math.max(0, Math.min(100, n)) / 100 }))
  }
  const setInt = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value)
    if (!isFinite(n)) return
    setForm(f => ({ ...f, [k]: Math.max(0, Math.round(n)) }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setMsg('已儲存')
        setTimeout(() => setMsg(null), 2000)
      } else {
        setMsg(`儲存失敗：${json.error || '未知錯誤'}`)
      }
    } catch {
      setMsg('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
        <Brain size={16} className="text-purple-500" />
        <h4 className="text-sm font-semibold text-slate-900">AI 分析參數</h4>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          <Loader2 size={16} className="inline animate-spin mr-2" /> 載入中…
        </div>
      ) : (
        <div className="p-5 space-y-6">
          {/* Business context */}
          <div>
            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              本店業務背景（所有 AI 報告都會參考）
            </h5>
            <textarea
              value={form.business_context || ''}
              onChange={e => setForm(f => ({ ...f, business_context: e.target.value.slice(0, 500) }))}
              className={`${inputCls} resize-none`}
              rows={4}
              placeholder="例：本店為 BE& 西門，精品咖啡 + 烘焙部複合型態。烘焙早班 05:30 開工屬正常。外場 HK 班是支援隔壁旅館房務的跨單位調度，不是標準外場工時。"
            />
            <p className="mt-1 text-xs text-slate-400 text-right">
              {(form.business_context || '').length}/500
            </p>
          </div>

          {/* Labor cost knobs */}
          <div className="border-t border-slate-200 pt-5">
            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              人力成本分析參數
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>目標人力成本率 (%)</label>
                <input type="number" step="0.1" min={0} max={100}
                  value={pctStr(form.labor_target_cost_ratio)}
                  onChange={setPct('labor_target_cost_ratio')}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">KPI 卡片紅綠燈基準（預設 30%）</p>
              </div>
              <div className="sm:col-span-1">
                <label className={labelCls}>PT 健康薪資占比區間 (%)</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="1" min={0} max={100}
                    value={pctStr(form.labor_pt_healthy_min)}
                    onChange={setPct('labor_pt_healthy_min')}
                    className={inputCls} />
                  <span className="text-slate-400 text-xs">～</span>
                  <input type="number" step="1" min={0} max={100}
                    value={pctStr(form.labor_pt_healthy_max)}
                    onChange={setPct('labor_pt_healthy_max')}
                    className={inputCls} />
                </div>
                <p className="text-xs text-slate-400 mt-1">兼職薪資占比落在此區間視為健康（預設 30-40%）</p>
              </div>
              <div>
                <label className={labelCls}>OT 單月上限 (小時)</label>
                <input type="number" step="1" min={0} max={200}
                  value={form.labor_ot_monthly_cap}
                  onChange={setInt('labor_ot_monthly_cap')}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">勞基法：46h（超過即觸發 flag）</p>
              </div>
              <div>
                <label className={labelCls}>OT 三個月累計上限 (小時)</label>
                <input type="number" step="1" min={0} max={600}
                  value={form.labor_ot_quarterly_cap}
                  onChange={setInt('labor_ot_quarterly_cap')}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">勞基法：138h</p>
              </div>
              <div>
                <label className={labelCls}>FT 月工時偏低警戒 (小時)</label>
                <input type="number" step="1" min={0} max={300}
                  value={form.labor_ft_low_threshold}
                  onChange={setInt('labor_ft_low_threshold')}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">正職月均工時低於此值會標 flag（預設 140h）</p>
              </div>
              <div>
                <label className={labelCls}>PT 月工時偏高警戒 (小時)</label>
                <input type="number" step="1" min={0} max={300}
                  value={form.labor_pt_high_threshold}
                  onChange={setInt('labor_pt_high_threshold')}
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">兼職月均工時高於此值會標 flag（預設 80h）</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">{msg}</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
