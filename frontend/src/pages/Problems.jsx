/**
 * Problems.jsx — Infinite scroll problems list
 *
 * Features:
 *  - Infinite scroll (loads 10 at a time, fetches next batch on scroll)
 *  - Query caching (staleTime=30s, previously loaded pages stay cached)
 *  - Striver-sheet style topic filter (collapsible tag chips)
 *  - Difficulty / language / sort filters
 *  - Global search with debounce
 *  - Table view (desktop) + card view (mobile)
 *  - Delete with confirmation
 *  - URL-synced filter state
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  Trash2, X, AlertTriangle,
  ExternalLink, Code2, CheckCircle2, LayoutList, LayoutGrid,
  BookOpen, ChevronDown, Filter, Loader2,
} from 'lucide-react'
import { fetchSubmissions, deleteSubmission, fetchAllTags, fetchAllLanguages } from '../lib/api'
import EmptyState from '../components/EmptyState'

const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Difficulty styling
// ---------------------------------------------------------------------------
const DIFF_STYLES = {
  Easy:   { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  Medium: { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  Hard:   { badge: 'bg-red-500/15 text-red-400 border-red-500/25' },
}

function DiffBadge({ difficulty }) {
  const s = DIFF_STYLES[difficulty]
  if (!s) return null
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${s.badge}`}>
      {difficulty}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
const RowSkeleton = () => (
  <tr className="animate-pulse border-b border-zinc-800/50">
    <td className="px-4 py-3"><div className="h-4 bg-zinc-800 rounded w-4" /></td>
    <td className="px-3 py-3"><div className="h-3 bg-zinc-800 rounded w-6" /></td>
    <td className="px-3 py-3"><div className="h-3 bg-zinc-800 rounded w-12" /></td>
    <td className="px-3 py-3"><div className="h-3 bg-zinc-800 rounded w-48" /></td>
    <td className="px-3 py-3 hidden sm:table-cell"><div className="h-4 bg-zinc-800 rounded-full w-14" /></td>
    <td className="px-3 py-3 hidden md:table-cell"><div className="h-3 bg-zinc-800 rounded w-16" /></td>
    <td className="px-3 py-3 hidden lg:table-cell"><div className="h-3 bg-zinc-800 rounded w-12" /></td>
    <td className="px-4 py-3"><div className="h-3 bg-zinc-800 rounded w-20" /></td>
  </tr>
)

const CardSkeleton = () => (
  <div className="animate-pulse rounded-xl bg-zinc-800/60 border border-zinc-700/40 p-4 space-y-3">
    <div className="flex justify-between">
      <div className="h-4 bg-zinc-700 rounded w-40" />
      <div className="h-5 bg-zinc-700 rounded-full w-16" />
    </div>
    <div className="h-3 bg-zinc-700 rounded w-24" />
    <div className="flex gap-2">
      <div className="h-5 bg-zinc-700 rounded-full w-14" />
      <div className="h-5 bg-zinc-700 rounded-full w-14" />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Delete Modal
// ---------------------------------------------------------------------------
function DeleteModal({ title, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700/60 shadow-2xl p-6 space-y-4">
        <button onClick={onCancel} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-red-950/60 p-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-white font-semibold text-base">Delete Submission</h2>
        </div>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-medium text-white">"{title}"</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onCancel} disabled={isDeleting} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-medium transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-50">
            {isDeleting ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------
function ProblemRow({ submission, rowIndex, onNavigate, onDelete }) {
  return (
    <tr
      className="group border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors cursor-pointer"
      onClick={() => onNavigate(submission.id)}
    >
      {/* ✓ solved */}
      <td className="px-4 py-3 w-8">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      </td>
      {/* Sequential ID */}
      <td className="px-3 py-3 w-12">
        <span className="text-xs font-mono text-zinc-600">{rowIndex}</span>
      </td>
      {/* LeetCode number */}
      <td className="px-3 py-3 w-20">
        {submission.problem_id ? (
          <span className="text-xs font-mono font-semibold text-orange-400/80 bg-orange-500/8 border border-orange-500/15 px-2 py-0.5 rounded">
            LC:{submission.problem_id}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </td>
      {/* Title */}
      <td className="px-3 py-3">
        <span className="text-sm font-medium text-zinc-100 group-hover:text-white transition">
          {submission.problem_title}
        </span>
      </td>
      {/* Difficulty */}
      <td className="px-3 py-3 hidden sm:table-cell w-28">
        <DiffBadge difficulty={submission.difficulty} />
      </td>
      {/* Language */}
      <td className="px-3 py-3 hidden md:table-cell w-28">
        <span className="flex items-center gap-1 text-xs text-orange-400">
          <Code2 className="w-3 h-3" />{submission.language}
        </span>
      </td>
      {/* Topics */}
      <td className="px-3 py-3 hidden lg:table-cell w-36">
        {submission.tags && submission.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {submission.tags.slice(0, 2).map((t) => (
              <span key={t} className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/40 px-1.5 py-0.5 rounded">{t}</span>
            ))}
            {submission.tags.length > 2 && <span className="text-[10px] text-zinc-600">+{submission.tags.length - 2}</span>}
          </div>
        )}
      </td>
      {/* Actions */}
      <td className="px-4 py-3 w-20">
        <div className="flex items-center justify-end gap-1.5">
          {submission.url && (
            <a href={submission.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-orange-400 transition" title="Open on LeetCode">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(submission) }}
            className="p-1.5 rounded hover:bg-red-950/60 text-zinc-500 hover:text-red-400 transition" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Card (mobile)
// ---------------------------------------------------------------------------
function ProblemCard({ submission, rowIndex, onNavigate, onDelete }) {
  return (
    <div
      className="rounded-xl bg-zinc-900/60 border border-zinc-800/60 p-4 cursor-pointer hover:border-zinc-600/60 hover:bg-zinc-900/80 transition-all group"
      onClick={() => onNavigate(submission.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* ID row: sequential # | LC badge | difficulty */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-zinc-600">#{rowIndex}</span>
            {submission.problem_id && (
              <span className="text-xs font-mono font-semibold text-orange-400/80 bg-orange-500/8 border border-orange-500/15 px-1.5 py-0.5 rounded">
                LC:{submission.problem_id}
              </span>
            )}
            <DiffBadge difficulty={submission.difficulty} />
          </div>
          <h3 className="text-sm font-semibold text-white truncate group-hover:text-orange-400 transition">
            {submission.problem_title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <Code2 className="w-3 h-3" />{submission.language}
            </span>
            {submission.runtime && <span className="text-[10px] text-purple-400">⚡ {submission.runtime}</span>}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(submission) }}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {submission.tags && submission.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {submission.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700/40 px-1.5 py-0.5 rounded">{t}</span>
          ))}
          {submission.tags.length > 4 && <span className="text-[10px] text-zinc-600">+{submission.tags.length - 4}</span>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Topic filter panel
// ---------------------------------------------------------------------------
function TopicFilterPanel({ tags, selectedTag, onSelect }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? tags : tags.slice(0, 20)

  if (tags.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Filter by Topic</h3>
        </div>
        {selectedTag && (
          <button
            onClick={() => onSelect('')}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visible.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelect(selectedTag === tag ? '' : tag)}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
              selectedTag === tag
                ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:border-zinc-500/60 hover:text-zinc-200'
            }`}
          >
            {selectedTag === tag && <span className="mr-1">✓</span>}
            {tag}
          </button>
        ))}

        {tags.length > 20 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition"
          >
            {showAll ? (
              <><ChevronDown className="w-3 h-3 rotate-180" /> Show less</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> +{tags.length - 20} more</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Infinite scroll sentinel
// ---------------------------------------------------------------------------
function ScrollSentinel({ onVisible }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible() },
      { threshold: 0.1, rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onVisible])
  return <div ref={ref} className="h-4" />
}

// ---------------------------------------------------------------------------
// Problems page
// ---------------------------------------------------------------------------
export default function Problems() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Sync filters with URL search params
  const search     = searchParams.get('search') || ''
  const difficulty = searchParams.get('difficulty') || ''
  const tag        = searchParams.get('tag') || ''
  const language   = searchParams.get('language') || ''
  const sort       = searchParams.get('sort') || 'newest'

  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [viewMode,      setViewMode]      = useState('table') // 'table' | 'grid'
  const [localSearch,   setLocalSearch]   = useState(search)
  const [showFilters,   setShowFilters]   = useState(false)
  const searchTimer = useRef(null)

  const setParam = useCallback(
    (updates) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(updates).forEach(([k, v]) => {
          if (v) next.set(k, v)
          else next.delete(k)
        })
        return next
      })
    },
    [setSearchParams]
  )

  // Sync local search ↔ URL
  useEffect(() => { setLocalSearch(search) }, [search])

  const handleSearchInput = (e) => {
    const val = e.target.value
    setLocalSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setParam({ search: val }), 350)
  }

  // Sort map
  const sortMap = { newest: { sortBy: 'created_at', sortOrder: 'desc' }, oldest: { sortBy: 'created_at', sortOrder: 'asc' }, number: { sortBy: 'problem_id', sortOrder: 'asc' }, title: { sortBy: 'problem_title', sortOrder: 'asc' } }
  const { sortBy, sortOrder } = sortMap[sort] || sortMap.newest

  // ── Infinite query ─────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetchingNextPage,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['submissions', { search, difficulty, tag, language, sort }],
    queryFn: ({ pageParam = 1 }) =>
      fetchSubmissions({ page: pageParam, perPage: PAGE_SIZE, search, difficulty, tag, language, sortBy, sortOrder }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p.data?.length ?? 0), 0)
      const total = lastPage.total ?? lastPage.count ?? 0
      return loaded < total ? allPages.length + 1 : undefined
    },
    staleTime: 1000 * 30,       // 30s cache — re-opens feel instant
    gcTime: 1000 * 60 * 5,      // 5min garbage collect
    keepPreviousData: true,
  })

  const { data: tagsData } = useQuery({
    queryKey: ['allTags'],
    queryFn: fetchAllTags,
    staleTime: 1000 * 60 * 10,  // 10min cache
    gcTime: 1000 * 60 * 30,
  })

  const { data: languagesData } = useQuery({
    queryKey: ['allLanguages'],
    queryFn: fetchAllLanguages,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  })

  // Flatten all pages into a single array
  const submissions = data?.pages?.flatMap((p) => p.data ?? []) ?? []
  const total       = data?.pages?.[0]?.total ?? data?.pages?.[0]?.count ?? 0

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSubmission(id),
    onSuccess: () => {
      toast.success('Submission deleted.')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
    onError: (err) => {
      toast.error(`Failed to delete: ${err?.message || 'Unknown error'}`)
    },
  })

  const activeFilterCount = [
    search, difficulty, tag, language,
    sort !== 'newest' ? sort : null,
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setLocalSearch('')
    setParam({ search: '', difficulty: '', tag: '', language: '', sort: '' })
  }

  // ── Prefetch next page when near bottom ────────────────────────────────────
  const handleSentinelVisible = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">My Problems</h1>
            <p className="mt-0.5 text-zinc-400 text-xs sm:text-sm hidden sm:block">
              Browse and manage your synced LeetCode solutions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {total > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2.5 py-1 text-xs sm:text-sm font-medium">
                {total.toLocaleString()} total
              </span>
            )}
            {/* View toggle */}
            <div className="flex rounded-lg border border-zinc-700/50 overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition ${viewMode === 'table' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                title="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────── */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[140px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search problems…"
                value={localSearch}
                onChange={handleSearchInput}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-700/50 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 hover:border-zinc-600 transition"
              />
              {localSearch && (
                <button
                  onClick={() => { setLocalSearch(''); setParam({ search: '' }) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Difficulty */}
            <select
              value={difficulty}
              onChange={(e) => setParam({ difficulty: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:border-orange-500/50 hover:border-zinc-600 transition appearance-none cursor-pointer"
            >
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            {/* Language */}
            <select
              value={language}
              onChange={(e) => setParam({ language: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:border-orange-500/50 hover:border-zinc-600 transition appearance-none cursor-pointer"
            >
              <option value="">All Languages</option>
              {(languagesData || []).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setParam({ sort: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:border-orange-500/50 hover:border-zinc-600 transition appearance-none cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="number">Problem number</option>
              <option value="title">Title A–Z</option>
            </select>

            {/* Toggle topic filter */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                showFilters || tag
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                  : 'bg-zinc-900 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Topics
              {tag && <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-orange-500 text-black">1</span>}
            </button>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg text-zinc-400 bg-zinc-900 border border-zinc-700/50 hover:text-white hover:border-zinc-600 transition"
              >
                <X className="w-3 h-3" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Active tag pills */}
          {(difficulty || tag || language) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-600">Active:</span>
              {difficulty && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700/40 text-zinc-300">
                  {difficulty}
                  <button onClick={() => setParam({ difficulty: '' })} className="text-zinc-500 hover:text-zinc-200 ml-0.5"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {language && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700/40 text-zinc-300">
                  {language}
                  <button onClick={() => setParam({ language: '' })} className="text-zinc-500 hover:text-zinc-200 ml-0.5"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {tag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-500/10 border border-orange-500/25 text-orange-400">
                  {tag}
                  <button onClick={() => setParam({ tag: '' })} className="text-orange-400/60 hover:text-orange-300 ml-0.5"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
            </div>
          )}

          {/* Topic filter panel */}
          {showFilters && (
            <TopicFilterPanel
              tags={tagsData || []}
              selectedTag={tag}
              onSelect={(t) => setParam({ tag: t })}
            />
          )}
        </div>

        {/* ── Error ────────────────────────────────────────────────────── */}
        {isError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-red-400 text-sm">
            Failed to load submissions: {error?.message || 'Unknown error'}
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        <div className={`transition-opacity duration-200 ${isFetching && !isLoading && !isFetchingNextPage ? 'opacity-70' : 'opacity-100'}`}>

          {isLoading ? (
            viewMode === 'table' ? (
              <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-900/50 border-b border-zinc-800/60">
                    <tr>
                      {['', '#', 'LC No', 'Title', 'Difficulty', 'Language', 'Topics', ''].map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => <RowSkeleton key={i} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )
          ) : submissions.length === 0 ? (
            <EmptyState
              title={search || difficulty || tag || language ? 'No matching problems' : 'No submissions yet'}
              description={
                search || difficulty || tag || language
                  ? 'Try adjusting your filters or search query.'
                  : 'Install the Chrome extension and solve problems on LeetCode to sync them here.'
              }
              action={
                search || difficulty || tag || language
                  ? { label: 'Clear Filters', onClick: clearAllFilters }
                  : undefined
              }
            />
          ) : viewMode === 'table' ? (
            <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-900/50 border-b border-zinc-800/60 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-8" />
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-12">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-20">LC No</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Title</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hidden sm:table-cell w-28">Difficulty</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hidden md:table-cell w-28">Language</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hidden lg:table-cell w-36">Topics</th>
                    <th className="px-4 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, idx) => (
                    <ProblemRow
                      key={s.id}
                      submission={s}
                      rowIndex={idx + 1}
                      onNavigate={(id) => navigate(`/problems/${id}`)}
                      onDelete={(sub) => setDeleteTarget({ id: sub.id, title: sub.problem_title })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {submissions.map((s, idx) => (
                <ProblemCard
                  key={s.id}
                  submission={s}
                  rowIndex={idx + 1}
                  onNavigate={(id) => navigate(`/problems/${id}`)}
                  onDelete={(sub) => setDeleteTarget({ id: sub.id, title: sub.problem_title })}
                />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {!isLoading && submissions.length > 0 && (
            <ScrollSentinel onVisible={handleSentinelVisible} />
          )}

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-6 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              Loading more problems…
            </div>
          )}

          {/* End of list */}
          {!isLoading && !hasNextPage && submissions.length > 0 && (
            <p className="text-center text-zinc-600 text-xs py-4">
              All {total.toLocaleString()} problem{total !== 1 ? 's' : ''} loaded
            </p>
          )}
        </div>
      </div>

      {/* ── Delete Modal ────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
