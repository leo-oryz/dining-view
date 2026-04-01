import { TrendingUp } from 'lucide-react'

export default function DigitalPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="bg-blue-50 rounded-full p-4 mb-4">
        <TrendingUp size={32} className="text-blue-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">數位行銷數據</h2>
      <p className="text-slate-500 text-sm">Phase 2 上線</p>
      <p className="text-slate-400 text-xs mt-2">
        將整合 Google Analytics、Search Console、Meta Ads、TikTok Ads 數據
      </p>
    </div>
  )
}
