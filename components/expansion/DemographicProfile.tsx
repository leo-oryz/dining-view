'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface DemographicData {
  gender: { male: number; female: number; unknown: number }
  age: { label: string; count: number }[]
}

interface DemographicProfileProps {
  data: DemographicData | null
}

const GENDER_COLORS = ['#3b82f6', '#ec4899', '#94a3b8']
const AGE_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316']

export function DemographicProfile({ data }: DemographicProfileProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        尚無人口統計資料
      </div>
    )
  }

  const genderData = [
    { name: '男性', value: data.gender.male },
    { name: '女性', value: data.gender.female },
    ...(data.gender.unknown > 0 ? [{ name: '未知', value: data.gender.unknown }] : []),
  ].filter((d) => d.value > 0)

  const ageData = data.age.filter((d) => d.count > 0)

  const chartHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 180 : 220

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Gender */}
      <div>
        <h4 className="text-sm font-medium text-slate-600 mb-2">性別分布</h4>
        {genderData.length > 0 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                {genderData.map((_, i) => (
                  <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-slate-400">無資料</div>
        )}
      </div>

      {/* Age */}
      <div>
        <h4 className="text-sm font-medium text-slate-600 mb-2">年齡分布</h4>
        {ageData.length > 0 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={ageData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70}>
                {ageData.map((_, i) => (
                  <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-slate-400">無資料</div>
        )}
      </div>
    </div>
  )
}
