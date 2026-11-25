/**
 * Layout.jsx
 * -----------
 * Main application layout with:
 *  - Collapsible left sidebar (icon-only → full on hover/desktop)
 *  - Top header bar with page title, search, and connection status
 *  - Mobile-responsive bottom navigation
 *  - Dark theme with orange (#FFA116) accent
 */

import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Code2, Settings, GitBranch, BookOpen, Search, X, Wifi, WifiOff, RefreshCw, FileDown, LogOut } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSubmissions } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

/* ─── Navigation items ─────────────────────────────────────────────────────── */
const navItems = [
  { to: '/',          icon: Home,      label: 'Dashboard',      shortLabel: 'Home',     exact: true },
  { to: '/revision',  icon: RefreshCw, label: 'Revision',       shortLabel: 'Revision'               },
  { to: '/topics',    icon: BookOpen,  label: 'Topics Manager', shortLabel: 'Topics'               },
  { to: '/problems',     icon: Code2,     label: 'Problems',       shortLabel: 'Problems'               },
  { to: '/download-pdf', icon: FileDown,  label: 'Download PDF',   shortLabel: 'PDF'                    },
  { to: '/settings',     icon: Settings,  label: 'Settings',       shortLabel: 'Settings'               },
]

/* ─── Logo component ────────────────────────────────────────────────────────── */
function LCSyncLogo({ collapsed }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <img
        src="/favicon.png"
        alt="LC Sync"
        className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
      />

      {!collapsed && (
        <span className="font-bold text-lg tracking-tight text-[#FFA116] whitespace-nowrap">
          LC&nbsp;<span className="text-white">Sync</span>
        </span>
      )}
    </div>
  )
}

/* ─── Single nav link ───────────────────────────────────────────────────────── */
function SideNavItem({ item, collapsed }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-white/5',
          isActive
            ? 'bg-orange-500/10 text-[#FFA116] border border-orange-500/20'
            : 'text-gray-400 hover:text-white border border-transparent',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#FFA116] rounded-r-full" />
          )}

          <Icon
            className={`w-5 h-5 flex-shrink-0 transition-colors ${
              isActive ? 'text-[#FFA116]' : 'text-gray-400 group-hover:text-white'
            }`}
          />

          {!collapsed && (
            <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
          )}

          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 text-xs font-medium bg-gray-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-white/10">
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

/* ─── Global Search ────────────────────────────────────────────────────────── */
function GlobalSearch({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const { data } = await fetchSubmissions({ search: q, perPage: 8, withCount: false })
      setResults(data || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 280)
  }

  const handleSelect = (id) => {
    navigate(`/problems/${id}`)
    onClose()
  }

  const DIFF_COLORS = { Easy: 'text-emerald-400', Medium: 'text-yellow-400', Hard: 'text-red-400' }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search problems by title, tag, language…"
            value={query}
            onChange={handleChange}
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/10 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="py-8 text-center text-sm text-gray-500">Searching…</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">No results found</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-xs text-gray-600 font-mono w-8 flex-shrink-0">
                #{r.problem_id || '?'}
              </span>
              <span className="flex-1 text-sm text-white truncate">{r.problem_title}</span>
              <span className={`text-xs font-medium ${DIFF_COLORS[r.difficulty] || 'text-gray-500'}`}>
                {r.difficulty}
              </span>
            </button>
          ))}
          {!query && (
            <div className="py-8 text-center text-sm text-gray-500">
              Start typing to search your solutions…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Page title map ────────────────────────────────────────────────────────── */
function usePageTitle() {
  const { pathname } = useLocation()
  if (pathname === '/')                  return 'Dashboard'
  if (pathname.startsWith('/problems/')) return 'Problem Detail'
  if (pathname.startsWith('/problems'))  return 'Problems'
  if (pathname.startsWith('/revision'))  return 'Revision'
  if (pathname.startsWith('/topics'))    return 'Topics Manager'
  if (pathname.startsWith('/recent'))    return 'Recent Submissions'
  if (pathname.startsWith('/settings'))      return 'Settings'
  if (pathname.startsWith('/download-pdf'))  return 'Download PDF'
  return 'LC Sync'
}

/* ─── Main Layout ───────────────────────────────────────────────────────────── */
export default function Layout({ children, connected = true }) {
  const [hovered,      setHovered]      = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [isMobile,     setIsMobile]     = useState(false)
  const [searchOpen,   setSearchOpen]   = useState(false)
  const pageTitle = usePageTitle()
  const { user, logout } = useAuth()
  const handleLogout = async () => { await logout() }

  /* Detect mobile viewport */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* Close mobile drawer on route change */
  const { pathname } = useLocation()
  useEffect(() => { setMobileOpen(false) }, [pathname])

  /* Ctrl+K / Cmd+K to open search */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const sidebarExpanded = !isMobile && hovered

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white overflow-hidden">

      {/* ── Global Search Overlay ────────────────────────────────────────────── */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      {!isMobile && (
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`
            hidden md:flex flex-col flex-shrink-0 h-full
            bg-[#111111] border-r border-white/5
            transition-all duration-300 ease-in-out
            ${sidebarExpanded ? 'w-60' : 'w-16'}
          `}
        >
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-white/5">
            <LCSyncLogo collapsed={!sidebarExpanded} />
          </div>

          {/* Nav links */}
          <nav className="flex-1 flex flex-col gap-1 px-2 pt-4 overflow-y-auto scrollbar-none">
            {navItems.map((item) => (
              <SideNavItem key={item.to} item={item} collapsed={!sidebarExpanded} />
            ))}
          </nav>

          {/* Bottom: GitHub link */}
          <div className="px-2 pb-4 border-t border-white/5 pt-3">
            <a
              href="https://github.com/BhanuPrakash-004/lc-sync"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition-all duration-200"
            >
              <GitBranch className="w-5 h-5 flex-shrink-0" />
              {sidebarExpanded && (
                <span className="text-sm font-medium whitespace-nowrap">GitHub</span>
              )}
              {!sidebarExpanded && (
                <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 text-xs font-medium bg-gray-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-white/10">
                  GitHub
                </span>
              )}
            </a>
          </div>
        </aside>
      )}

      {/* ── Mobile Drawer Overlay ─────────────────────────────────────────── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ─────────────────────────────────────────────────── */}
      {isMobile && (
        <aside
          className={`
            fixed top-0 left-0 h-full w-64 z-50
            bg-[#111111] border-r border-white/5
            flex flex-col
            transform transition-transform duration-300 ease-in-out
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/5">
            <LCSyncLogo collapsed={false} />
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 flex flex-col gap-1 px-2 pt-4 overflow-y-auto">
            {navItems.map((item) => (
              <SideNavItem key={item.to} item={item} collapsed={false} />
            ))}
          </nav>

          <div className="px-2 pb-6 border-t border-white/5 pt-3">
            <a
              href="https://github.com/BhanuPrakash-004/lc-sync"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <GitBranch className="w-5 h-5" />
              <span className="text-sm font-medium">GitHub</span>
            </a>
          </div>
        </aside>
      )}

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* ── Top Header ──────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between h-16 px-4 md:px-6 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-3">
            {/* Hamburger – mobile only */}
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition md:hidden"
                aria-label="Open menu"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-current" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6"  x2="21" y2="6"  />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}

            {/* Page title */}
            <h1 className="text-base font-semibold text-white tracking-tight">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Search shortcut */}
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:border-white/20 hover:text-white transition-all duration-200"
              onClick={() => setSearchOpen(true)}
              aria-label="Search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white/5 border border-white/10 rounded">
                ⌃K
              </kbd>
            </button>

            {/* Connection status */}
            <div
              className="flex items-center gap-1.5 text-xs font-medium"
              title={connected ? 'Supabase connected' : 'Not connected'}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  connected
                    ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.4)]'
                    : 'bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.4)]'
                }`}
              />
              <span className={`hidden sm:inline ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* User avatar + logout */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-white/8">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white select-none flex-shrink-0 bg-gradient-to-br from-orange-500 to-amber-500"
                  title={user.email}
                >
                  {(user.email || 'U')[0].toUpperCase()}
                </div>
                <span className="hidden md:block text-xs text-zinc-400 font-medium max-w-[100px] truncate">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  aria-label="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* ── Mobile Bottom Nav ───────────────────────────────────────────── */}
        {isMobile && (
          <nav className="flex-shrink-0 flex items-center justify-around h-16 border-t border-white/5 bg-[#111111] md:hidden px-1 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 min-w-[48px] py-1.5 rounded-lg transition-all ${
                      isActive ? 'text-[#FFA116]' : 'text-gray-500 hover:text-gray-300'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-[#FFA116]' : ''}`} />
                      <span className="text-[10px] font-medium tracking-tight truncate max-w-[54px] text-center">{item.shortLabel || item.label}</span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
