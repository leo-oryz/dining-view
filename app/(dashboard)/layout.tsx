'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Clock,
  ShoppingBag,
  Users,
  Megaphone,
  Upload,
  TrendingUp,
  Brain,
  MessageSquare,
  BarChart3,
  Truck,
  Menu,
  X,
  LogOut,
  ChevronDown,
  GitCompareArrows,
  FileText,
  Bell,
  Settings,
  Download,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  ownerOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: '今日概覽', icon: LayoutDashboard },
  { href: '/heatmap', label: '時段分析', icon: Clock },
  { href: '/products', label: '商品排行', icon: ShoppingBag },
  { href: '/members', label: '會員趨勢', icon: Users },
  { href: '/digital', label: '數位行銷', icon: TrendingUp },
  { href: '/ai', label: 'AI 分析', icon: Brain },
  { href: '/line', label: 'LINE 推播', icon: MessageSquare },
  { href: '/ads', label: '廣告管理', icon: BarChart3 },
  { href: '/delivery', label: '外送平台', icon: Truck },
  { href: '/export', label: '資料匯出', icon: Download },
  { href: '/compare', label: '跨店對比', icon: GitCompareArrows, ownerOnly: true },
  { href: '/reports', label: '投資人報告', icon: FileText, ownerOnly: true },
  { href: '/expansion', label: '展店分析', icon: Building2, ownerOnly: true },
  { href: '/alerts', label: '異常警報', icon: Bell },
  { href: '/campaigns', label: '活動管理', icon: Megaphone },
  { href: '/upload', label: '資料上傳', icon: Upload },
  { href: '/settings', label: '系統設定', icon: Settings, ownerOnly: true },
]

// Bottom tab bar items for mobile (5 most-used)
const mobileTabItems: NavItem[] = [
  { href: '/dashboard', label: '概覽', icon: LayoutDashboard },
  { href: '/products', label: '商品', icon: ShoppingBag },
  { href: '/members', label: '會員', icon: Users },
  { href: '/ai', label: 'AI', icon: Brain },
  { href: '/upload', label: '上傳', icon: Upload },
]

type UserProfile = {
  role: string
  store_id: string | null
  name: string | null
  email: string
}

type Store = {
  id: string
  name: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [activeStore, setActiveStore] = useState<string | null>(null)
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/login')
        return
      }
      const json = await res.json()
      if (!json.success) {
        router.push('/login')
        return
      }
      setProfile(json.data)

      if (json.data.role === 'owner') {
        const supabase = createClient()
        const { data: storeList } = await supabase
          .from('stores')
          .select('id, name')
          .order('name')
        if (storeList && storeList.length > 0) {
          setStores(storeList)
          setActiveStore(storeList[0].id)
        }
      } else if (json.data.store_id) {
        setActiveStore(json.data.store_id)
      }
    }
    loadProfile()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const activeStoreName = stores.find((s) => s.id === activeStore)?.name || 'BE& 西門'

  const filteredNavItems = navItems.filter(
    (item) => !item.ownerOnly || profile?.role === 'owner'
  )

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop only (>= 1024px), or slide-in on mobile when open */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 text-slate-200 transform transition-transform lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
          <Link href="/dashboard" className="text-lg font-bold text-white">
            FnB Pulse
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Store switcher (owner only) */}
        {profile?.role === 'owner' && stores.length > 1 && (
          <div className="px-3 mt-3 relative">
            <button
              onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-700 rounded-lg text-sm text-white hover:bg-slate-600 transition-colors min-h-[44px]"
            >
              <span className="truncate">{activeStoreName}</span>
              <ChevronDown size={16} className={clsx('transition-transform', storeDropdownOpen && 'rotate-180')} />
            </button>
            {storeDropdownOpen && (
              <div className="absolute left-3 right-3 mt-1 bg-slate-700 rounded-lg shadow-lg z-10 overflow-hidden">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => {
                      setActiveStore(store.id)
                      setStoreDropdownOpen(false)
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm transition-colors min-h-[44px]',
                      store.id === activeStore
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-600'
                    )}
                  >
                    {store.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="mt-4 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-4 left-0 right-0 px-3">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-xs text-slate-500 truncate">
              {profile?.email || ''}
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="登出"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-4 text-slate-600 hover:text-slate-900 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu size={24} />
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {navItems.find((item) => item.href === pathname)?.label || 'FnB Pulse'}
          </h2>
        </header>

        {/* Page content — add bottom padding on mobile for tab bar */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar — visible only on < 1024px */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 lg:hidden">
        <div className="flex items-center justify-around h-16">
          {mobileTabItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2',
                  isActive ? 'text-blue-600' : 'text-slate-400'
                )}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
          {/* More menu — opens sidebar */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={clsx(
              'flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 text-slate-400'
            )}
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium">更多</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
