import { Brain } from 'lucide-react'

export default function AiPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="bg-purple-50 rounded-full p-4 mb-4">
        <Brain size={32} className="text-purple-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">AI 分析</h2>
      <p className="text-slate-500 text-sm">Phase 2 上線</p>
      <p className="text-slate-400 text-xs mt-2">
        將提供每日營運摘要、異常偵測、活動效果歸因等 AI 分析報告
      </p>
    </div>
  )
}
