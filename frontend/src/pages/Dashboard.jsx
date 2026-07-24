import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Tag, Code2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { fetchStats, fetchSubmissions, deleteSubmission } from '../lib/api'
import StatsGrid from '../components/StatsGrid'
import SubmissionCard from '../components/SubmissionCard'
import ActivityChart from '../components/ActivityChart'

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------
const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-zinc-800 ${className}`} />
)

const SubmissionCardSkeleton = () => (
  <div className="animate-pulse rounded-xl bg-zinc-800/60 border border-zinc-700/40 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-5 w-16 rounded-full" />
    </div>
    <SkeletonBlock className="h-3 w-24" />
    <div className="flex gap-2">
      <SkeletonBlock className="h-5 w-14 rounded-full" />
      <SkeletonBlock className="h-5 w-14 rounded-full" />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// TopicsBar
// ---------------------------------------------------------------------------
const TOPIC_COLORS = [
  'bg-orange-500',
  'bg-orange-400',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-amber-400',
]

const TopicsBar = ({ tags }) => {
  if (!tags || tags.length === 0) {
    return (
      <p className="text-zinc-500 text-sm italic">No tag data available yet.</p>
    )
  }
  const max = tags[0]?.count || 1
  return (
    <div className="space-y-2.5">
      {tags.map((tag, i) => (
        <div key={tag.name} className="flex items-center gap-3">
          <span className="text-zinc-300 text-xs w-28 truncate shrink-0">{tag.name}</span>
          <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`${TOPIC_COLORS[i % TOPIC_COLORS.length]} h-2.5 rounded-full transition-all duration-700`}
              style={{ width: `${Math.round((tag.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-zinc-400 text-xs w-6 text-right shrink-0">{tag.count}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LanguageDonut
// ---------------------------------------------------------------------------
const LANG_COLORS = [
  '#FFA116',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#3B82F6',
  '#10B981',
  '#EC4899',
]

const LanguageDonut = ({ languages }) => {
  if (!languages || languages.length === 0) {
    return (
      <p className="text-zinc-500 text-sm italic">No language data available yet.</p>
    )
  }
  const total = languages.reduce((s, l) => s + l.count, 0)
  return (
    <div className="flex flex-wrap gap-3">
      {languages.map((lang, i) => {
        const pct = total > 0 ? Math.round((lang.count / total) * 100) : 0
        return (
          <div
            key={lang.name}
            className="flex items-center gap-2 bg-zinc-800/70 rounded-lg px-3 py-2 border border-zinc-700/40"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }}
            />
            <span className="text-zinc-200 text-sm font-medium">{lang.name}</span>
            <span className="text-zinc-500 text-xs">({pct}%)</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
const Section = ({ title, action, children }) => (
  <section className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

// ---------------------------------------------------------------------------
// RevisionWidget
// ---------------------------------------------------------------------------
function RevisionWidget({ problems, onMarkRevised }) {
  if (!problems || problems.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5 text-center">
        <p className="text-zinc-500 text-sm">✅ Nothing due for revision today!</p>
        <p className="text-zinc-600 text-xs mt-1">Solve some problems and mark them for later review.</p>
      </div>
    )
  }

  const DIFF_COLORS = { Easy: 'text-emerald-400', Medium: 'text-yellow-400', Hard: 'text-red-400' }

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
      <div className="divide-y divide-zinc-800/60">
        {problems.slice(0, 5).map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-semibold shrink-0 ${DIFF_COLORS[p.difficulty] || 'text-zinc-400'}`}>
                {p.difficulty?.charAt(0) || '?'}
              </span>
              <span className="text-sm text-zinc-200 truncate">{p.problem_title}</span>
              {p.revision_count > 0 && (
                <span className="text-[10px] text-zinc-600 shrink-0">×{p.revision_count}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {['easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  onClick={() => onMarkRevised(p.id, d)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition border ${
                    d === 'easy' ? 'border-emerald-800/50 text-emerald-500 hover:bg-emerald-950/40' :
                    d === 'medium' ? 'border-yellow-800/50 text-yellow-500 hover:bg-yellow-950/40' :
                    'border-red-800/50 text-red-500 hover:bg-red-950/40'
                  }`}
                  title={`Mark as ${d} - schedule revision in ${{ easy: 7, medium: 3, hard: 1 }[d]} days`}
                >
                  {d.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {problems.length > 5 && (
        <div className="px-4 py-2 text-center text-xs text-zinc-600 border-t border-zinc-800/60">
          +{problems.length - 5} more due
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// computeStreak – derives currentStreak, longestStreak, totalActiveDays
// ---------------------------------------------------------------------------
function toLocalDateKey(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function computeStreak(activityMap = {}) {
  const today = new Date()
  let longest = 0
  let temp = 0

  // Walk last 365 days to find longest streak
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = toLocalDateKey(d)
    if (activityMap[key]) {
      temp++
      longest = Math.max(longest, temp)
    } else {
      temp = 0
    }
  }

  // Current streak: consecutive days from today backwards
  let current = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = toLocalDateKey(d)
    if (activityMap[key]) {
      current++
    } else {
      break
    }
  }

  const totalActiveDays = Object.keys(activityMap).filter((k) => activityMap[k] > 0).length
  return { currentStreak: current, longestStreak: longest, totalActiveDays }
}

// ---------------------------------------------------------------------------
// StreakCard
// ---------------------------------------------------------------------------
const StreakCard = ({ streak, activity }) => {
  // Build last-7-days array (oldest → newest)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = toLocalDateKey(d)
    const dayName = d.toLocaleDateString('en', { weekday: 'short' })
    return { key, dayName, count: activity?.[key] || 0 }
  })

  return (
    <div className="rounded-xl border border-orange-500/10 bg-zinc-900/50 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">Current Streak</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-orange-400">{streak.currentStreak}</span>
            <span className="text-sm text-zinc-400">days 🔥</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Best: {streak.longestStreak} days</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Active days</p>
          <p className="text-lg font-bold text-zinc-300">{streak.totalActiveDays}</p>
        </div>
      </div>
      {/* Mini bar chart – last 7 days */}
      <div className="flex items-end gap-1">
        {last7.map((day) => (
          <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm transition-all ${
                day.count > 0 ? 'bg-orange-500' : 'bg-zinc-700/50'
              }`}
              style={{ height: day.count > 0 ? `${Math.min(32, 8 + day.count * 8)}px` : '8px' }}
              title={`${day.key}: ${day.count} submission${day.count !== 1 ? 's' : ''}`}
            />
            <span className="text-[9px] text-zinc-600">{day.dayName.charAt(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const queryClient = useQueryClient()

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 2,
  })

  const {
    data: recent,
    isLoading: recentLoading,
    isError: recentError,
  } = useQuery({
    queryKey: ['recent'],
    queryFn: () => fetchSubmissions({ perPage: 5 }),
    staleTime: 1000 * 60,
  })

  // Delete mutation — fixes Issue 5: delete wasn't working from dashboard
  const deleteMutation = useMutation({
    mutationFn: deleteSubmission,
    onSuccess: () => {
      toast.success('Submission deleted')
      queryClient.invalidateQueries({ queryKey: ['recent'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => toast.error(`Delete failed: ${err?.message}`),
  })

  // Derive top tags from stats object if api provides them
  const topTags = useMemo(() => {
    if (!stats?.tagCounts) return []
    return Object.entries(stats.tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [stats])

  const topLanguages = useMemo(() => {
    if (!stats?.languageCounts) return []
    return Object.entries(stats.languageCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [stats])

  // Streak derived from activity map
  const streak = useMemo(() => computeStreak(stats?.activity), [stats?.activity])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 sm:space-y-10">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="mt-1 text-zinc-400 text-sm">
            Overview of your LeetCode progress synced via the extension.
          </p>
        </div>

        {/* ── Stats Grid ──────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
        ) : statsError ? (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-red-400 text-sm">
            Failed to load stats. Please refresh.
          </div>
        ) : (
          <StatsGrid stats={stats} />
        )}

        {/* ── Activity Chart ───────────────────────────────────────────── */}
        <Section title="Submission Activity">
          {statsLoading ? (
            <SkeletonBlock className="h-44 w-full" />
          ) : (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
              <ActivityChart activityData={stats?.activity} />
            </div>
          )}
        </Section>

        {/* ── Recent Submissions ───────────────────────────────────────── */}
        <Section
          title="Recent Submissions"
          action={
            <Link
              to="/recent"
              className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {recentLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <SubmissionCardSkeleton key={i} />)}
            </div>
          ) : recentError ? (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-red-400 text-sm">
              Failed to load recent submissions.
            </div>
          ) : recent?.data?.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-6 py-10 text-center">
              <Code2 className="mx-auto mb-3 w-10 h-10 text-zinc-600" />
              <p className="text-zinc-400 text-sm">
                No submissions yet. Install the Chrome extension to start syncing.
              </p>
              <Link
                to="/settings"
                className="mt-3 inline-block text-orange-400 hover:text-orange-300 text-sm font-medium"
              >
                Go to Settings →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(recent?.data ?? []).map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Bottom two-column grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Topics */}
          <Section
            title={
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-400" />
                Top Topics
              </span>
            }
          >
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <SkeletonBlock className="h-3 w-24" />
                      <SkeletonBlock className="h-2.5 flex-1" />
                      <SkeletonBlock className="h-3 w-4" />
                    </div>
                  ))}
                </div>
              ) : (
                <TopicsBar tags={topTags} />
              )}
            </div>
          </Section>

          {/* Recent Languages */}
          <Section
            title={
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-orange-400" />
                Languages Used
              </span>
            }
          >
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
              {statsLoading ? (
                <div className="flex flex-wrap gap-3">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonBlock key={i} className="h-8 w-28 rounded-lg" />
                  ))}
                </div>
              ) : (
                <LanguageDonut languages={topLanguages} />
              )}
            </div>
          </Section>

        </div>

        {/* ── Solving Streak ───────────────────────────────────────────── */}
        {!statsLoading && stats && (
          <Section
            title={
              <span className="flex items-center gap-2">
                <span>🔥</span> Solving Streak
              </span>
            }
          >
            <StreakCard streak={streak} activity={stats?.activity} />
          </Section>
        )}

      </div>
    </div>
  )
}
