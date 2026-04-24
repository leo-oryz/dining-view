'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
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
  Lock,
  Star,
  MoreHorizontal,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { useI18n, type TranslationKey } from '@/lib/i18n/context'
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher'

interface NavItem {
  href: string
  labelKey: TranslationKey
  icon: LucideIcon
  ownerOnly?: boolean
}

interface NavGroup {
  titleKey: TranslationKey
  items: NavItem[]
  iconColor?: string
}

const navGroups: NavGroup[] = [
  {
    titleKey: 'nav.operations',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { href: '/trends', labelKey: 'nav.trends', icon: TrendingUp },
      { href: '/alerts', labelKey: 'nav.alerts', icon: Bell },
    ],
  },
  {
    titleKey: 'nav.products',
    items: [
      { href: '/products', labelKey: 'nav.productRanking', icon: ShoppingBag },
      { href: '/delivery', labelKey: 'nav.delivery', icon: Truck },
      { href: '/labor', labelKey: 'nav.labor', icon: Clock },
    ],
  },
  {
    titleKey: 'nav.marketing',
    items: [
      { href: '/digital', labelKey: 'nav.digital', icon: TrendingUp },
      { href: '/ads', labelKey: 'nav.ads', icon: BarChart3 },
      { href: '/kol', labelKey: 'nav.kol', icon: Users },
      { href: '/line', labelKey: 'nav.line', icon: MessageSquare },
      { href: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
    ],
  },
  {
    titleKey: 'nav.members',
    items: [
      { href: '/members', labelKey: 'nav.memberTrends', icon: Users },
      { href: '/reviews', labelKey: 'nav.reviews', icon: Star },
    ],
  },
  {
    titleKey: 'nav.ai',
    iconColor: 'text-purple-400',
    items: [
      { href: '/ai', labelKey: 'nav.aiAnalysis', icon: Brain },
      { href: '/expansion', labelKey: 'nav.expansion', icon: Building2 },
    ],
  },
  {
    titleKey: 'nav.management',
    items: [
      { href: '/upload', labelKey: 'nav.upload', icon: Upload },
      { href: '/export', labelKey: 'nav.export', icon: Download },
      { href: '/compare', labelKey: 'nav.compare', icon: GitCompareArrows, ownerOnly: true },
      { href: '/reports', labelKey: 'nav.reports', icon: FileText, ownerOnly: true },
      { href: '/settings', labelKey: 'nav.settings', icon: Settings, ownerOnly: true },
    ],
  },
]

// Bottom tab bar items for mobile (4 fixed + "more")
const mobileTabItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/trends', labelKey: 'nav.trends', icon: TrendingUp },
  { href: '/products', labelKey: 'nav.productRanking', icon: ShoppingBag },
  { href: '/ai', labelKey: 'nav.aiAnalysis', icon: Brain },
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
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [activeStore, setActiveStore] = useState<string | null>(null)
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false)

  // Flat list for page title lookup
  const allNavItems = navGroups.flatMap((g) => g.items)

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
          const cookieStoreId = document.cookie
            .split('; ')
            .find((c) => c.startsWith('active_store_id='))
            ?.split('=')[1]
          const initial = storeList.find((s) => s.id === cookieStoreId)?.id || storeList[0].id
          setActiveStore(initial)
          if (!cookieStoreId || cookieStoreId !== initial) {
            document.cookie = `active_store_id=${initial}; path=/; max-age=2592000; samesite=lax`
          }
        }
      } else if (json.data.store_id) {
        setActiveStore(json.data.store_id)
        document.cookie = `active_store_id=${json.data.store_id}; path=/; max-age=2592000; samesite=lax`
      }
    }
    loadProfile()
  }, [router])

  function handleStoreSwitch(storeId: string) {
    document.cookie = `active_store_id=${storeId}; path=/; max-age=2592000; samesite=lax`
    setActiveStore(storeId)
    setStoreDropdownOpen(false)
    router.refresh()
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const activeStoreName = stores.find((s) => s.id === activeStore)?.name || ''
  const isOwner = profile?.role === 'owner'

  // Filter owner-only items from groups
  const filteredGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.ownerOnly || isOwner),
  })).filter((group) => group.items.length > 0)

  // Drawer groups: exclude items already in mobile tab bar
  const mobileTabHrefs = new Set(mobileTabItems.map((i) => i.href))
  const drawerGroups = filteredGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !mobileTabHrefs.has(item.href)),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 text-slate-200 transform transition-transform lg:transform-none flex flex-col lg:h-screen',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700 shrink-0">
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
        {isOwner && stores.length > 1 && (
          <div className="px-3 mt-3 relative shrink-0">
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
                    onClick={() => handleStoreSwitch(store.id)}
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

        <nav className="mt-4 px-3 overflow-y-auto flex-1 min-h-0">
          {filteredGroups.map((group, gi) => (
            <div key={group.titleKey} className={clsx(gi > 0 && 'mt-6')}>
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {t(group.titleKey)}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  const isAI = group.iconColor === 'text-purple-400'
                  const isOperations = group.titleKey === 'nav.operations'
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
                      <Icon
                        size={18}
                        className={clsx(
                          isActive ? 'text-white' : isAI ? 'text-purple-400' : isOperations ? 'text-white' : ''
                        )}
                      />
                      <span className="flex-1">{t(item.labelKey)}</span>
                      {item.ownerOnly && (
                        <Lock size={12} className="text-gray-400" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 px-3 pt-2 pb-4 border-t border-slate-700/50 mt-2">
          <div className="px-3 mb-2">
            <LocaleSwitcher />
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              {profile?.name && (
                <span className="text-sm text-slate-300 font-medium truncate">
                  {profile.name}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-white transition-colors shrink-0 p-1"
                title={t('nav.logout')}
              >
                <LogOut size={14} />
              </button>
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {profile?.email || ''}
            </div>
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
            {(() => {
              const item = allNavItems.find((item) => item.href === pathname)
              return item ? t(item.labelKey) : 'FnB Pulse'
            })()}
          </h2>
        </header>

        {/* Page content — add bottom padding on mobile for tab bar */}
        <main key={activeStore || 'no-store'} className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
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
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </Link>
            )
          })}
          {/* More button — opens bottom drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 text-slate-400"
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      {/* Mobile bottom drawer */}
      <div
        className={clsx(
          'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl transform transition-transform duration-300 ease-out lg:hidden',
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxHeight: '80vh' }}
      >
        {/* Drawer handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{t('nav.moreFeatures')}</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(80vh - 60px)' }}>
          {drawerGroups.map((group, gi) => (
            <div key={group.titleKey} className={clsx(gi > 0 && 'mt-4')}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                {t(group.titleKey)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  const isAI = group.iconColor === 'text-purple-400'
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={clsx(
                        'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center transition-colors',
                        isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Icon
                        size={22}
                        className={clsx(
                          isActive ? 'text-blue-600' : isAI ? 'text-purple-400' : ''
                        )}
                      />
                      <span className="text-xs font-medium leading-tight">
                        {t(item.labelKey)}
                      </span>
                      {item.ownerOnly && (
                        <Lock size={10} className="text-gray-400" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
