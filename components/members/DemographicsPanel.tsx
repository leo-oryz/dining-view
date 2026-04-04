'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

interface DemographicData {
  gender: { male: number; female: number; unknown: number }
  age: { label: string; count: number }[]
  channels: { direct: number; app: number; coupon: number; other: number }
}

interface DemographicsPanelProps {
  data: DemographicData | null
  loading: boolean
}

const GENDER_COLORS = ['#3b82f6', '#ec4899', '#94a3b8']
const AGE_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316']
const CHANNEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#94a3b8']

function pctLabel(value: number, total: number) {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

export default function DemographicsPanel({ data, loading }: DemographicsPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        載入中...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
        <p className="text-sm text-amber-800">尚無人口統計資料。請先上傳 Ocard 會員招募分析報表。</p>
      </div>
    )
  }

  const genderTotal = data.gender.male + data.gender.female + data.gender.unknown
  const genderData = [
    { name: '男性', value: data.gender.male },
    { name: '女性', value: data.gender.female },
    ...(data.gender.unknown > 0 ? [{ name: '未知', value: data.gender.unknown }] : []),
  ].filter((d) => d.value > 0)

  const ageData = data.age.filter((d) => d.count > 0)

  const channelData = [
    { name: '直接註冊', value: data.channels.direct },
    { name: 'Ocard App', value: data.channels.app },
    { name: '線上優惠券', value: data.channels.coupon },
    { name: '其他', value: data.channels.other },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Gender + Channel side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">性別分布</h4>
          {genderData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({ name, value }) => `${name} ${pctLabel(value, genderTotal)}`}
                  >
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [Number(value).toLocaleString(), '人數']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-xs text-slate-500">
                {genderData.map((g) => (
                  <span key={g.name}>{g.name}: {g.value.toLocaleString()} 人</span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">無資料</div>
          )}
        </div>

        {/* Channels */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">註冊管道分布</h4>
          {channelData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({ name, value }) => `${name} ${pctLabel(value, channelData.reduce((s, d) => s + d.value, 0))}`}
                  >
                    {channelData.map((_, i) => (
                      <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [Number(value).toLocaleString(), '人數']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-xs text-slate-500">
                {channelData.map((c) => (
                  <span key={c.name}>{c.name}: {c.value.toLocaleString()} 人</span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">無資料</div>
          )}
        </div>
      </div>

      {/* Age distribution - full width bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">年齡分布</h4>
        {ageData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ageData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [Number(value).toLocaleString(), '人數']}
                labelFormatter={(label) => `${label} 歲`}
              />
              <Bar dataKey="count" name="人數" radius={[4, 4, 0, 0]}>
                {ageData.map((_, i) => (
                  <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">無資料</div>
        )}
      </div>
    </div>
  )
}
