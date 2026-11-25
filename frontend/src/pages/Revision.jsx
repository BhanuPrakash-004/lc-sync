/**
 * Revision.jsx — DB-driven only, no static TOPIC_TREE
 *
 * Fixes:
 *  4. Topics are 100% from DB (fetchCustomTopics). No hardcoded TOPIC_TREE.
 *     If no DB topics exist, shows an empty state with a link to TopicsManager.
 *     Topic assignment popup shows DB topics + subtopics.
 *  5. Problem title format: #1  LC:1  Two Sum
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchRevisionData,
  toggleRevised,
  updateQuality,
  fetchCustomTopics,
} from '../lib/api'
import {
  CheckCircle2, Circle, ExternalLink, ChevronRight,
  Filter, Layers, Search, BookOpen, X, Settings,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Backwards-compatibility export for any legacy references
export const TOPIC_TREE = {}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / constants
// ─────────────────────────────────────────────────────────────────────────────
const DIFF_STYLES = {
  Easy:   { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  Medium: { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'   },
  Hard:   { badge: 'bg-red-500/15 text-red-400 border-red-500/25'            },
}

const QUALITY_OPTIONS = [
  { value: 100, label: '100%', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25' },
  { value:  90, label:  '90%', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { value:  80, label:  '80%', color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/25'  },
  { value:  70, label:  '70%', color: 'text-yellow-300',  bg: 'bg-yellow-500/10 border-yellow-500/20'  },
  { value:  60, label:  '60%', color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/25'  },
  { value:  50, label:  '50%', color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/25'        },
]

function qualityOption(val) {
  return QUALITY_OPTIONS.find((q) => q.value === val) || null
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
const RowSkeleton = () => (
  <div className="animate-pulse flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50">
    <div className="w-4 h-4 bg-zinc-800 rounded-full flex-shrink-0" />
    <div className="h-3 bg-zinc-800 rounded flex-1" />
    <div className="h-5 w-14 bg-zinc-800 rounded-full" />
    <div className="h-5 w-10 bg-zinc-800 rounded" />
  </div>
)

function DiffBadge({ difficulty }) {
  const s = DIFF_STYLES[difficulty]
  if (!s) return <span className="text-xs text-zinc-500">{difficulty || '—'}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${s.badge}`}>
      {difficulty}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QualityPicker
// ─────────────────────────────────────────────────────────────────────────────
function QualityPicker({ value, onChange, disabled }) {
  const q = qualityOption(value)
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className={`text-xs font-semibold px-2 py-0.5 rounded border bg-transparent cursor-pointer focus:outline-none transition ${
        q ? `${q.color} ${q.bg}` : 'text-zinc-500 bg-zinc-800 border-zinc-700'
      }`}
    >
      <option value="">Rate</option>
      {QUALITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Problem row — Fix #5: id:N  LC:N  Title
// ─────────────────────────────────────────────────────────────────────────────
function ProblemRow({ problem, rowIndex, onToggleRevised, onQualityChange }) {
  const navigate = useNavigate()

  return (
    <div
      className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer ${
        problem.is_revised ? 'bg-emerald-950/10' : ''
      }`}
      onClick={() => navigate(`/problems/${problem.id}`)}
    >
      {/* Revised checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleRevised(problem.id, !problem.is_revised) }}
        className="flex-shrink-0 transition-transform hover:scale-110"
        title={problem.is_revised ? 'Mark as not revised' : 'Mark as revised'}
      >
        {problem.is_revised
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          : <Circle className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />}
      </button>

      {/* Row number — id column */}
      <span className="text-xs font-mono text-zinc-600 flex-shrink-0 w-6 text-right hidden sm:block">
        {rowIndex}
      </span>

      {/* LC badge */}
      {problem.problem_id ? (
        <span className="flex-shrink-0 text-xs font-mono font-semibold text-orange-400/80 bg-orange-500/8 border border-orange-500/15 px-1.5 py-0.5 rounded hidden sm:inline-block">
          LC:{problem.problem_id}
        </span>
      ) : (
        <span className="flex-shrink-0 text-xs text-zinc-700 hidden sm:block">—</span>
      )}

      {/* Title */}
      <span className={`flex-1 text-sm font-medium truncate ${
        problem.is_revised ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100 group-hover:text-white'
      }`}>
        {/* Mobile: show LC inline */}
        {problem.problem_id && (
          <span className="text-orange-400/70 font-mono text-xs mr-1.5 sm:hidden">LC:{problem.problem_id}</span>
        )}
        {problem.problem_title}
      </span>

      {/* Difficulty */}
      <div className="flex-shrink-0 hidden sm:block">
        <DiffBadge difficulty={problem.difficulty} />
      </div>

      {/* Quality picker */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <QualityPicker value={problem.quality} onChange={(val) => onQualityChange(problem.id, val)} />
      </div>

      {/* External link + arrow */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {problem.url && (
          <a href={problem.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition" title="Open on LeetCode">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <span className="p-1 rounded text-zinc-600"><ChevronRight className="w-3.5 h-3.5" /></span>
      </div>
    </div>
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Main Revision page — Fix #4: DB topics only
// ─────────────────────────────────────────────────────────────────────────────
export default function Revision() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // ── Fetch DB topics (only source of truth — no static TOPIC_TREE) ──────────
  const { data: dbTopics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['customTopics'],
    queryFn: fetchCustomTopics,
    staleTime: 1000 * 60,
  })

  // Build topic list and subtopic map purely from DB
  const { topicList, topicTree } = useMemo(() => {
    const list = [...dbTopics].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const tree = {}
    list.forEach(t => {
      tree[t.name] = Array.isArray(t.subtopics) && t.subtopics.length > 0
        ? t.subtopics
        : ['General']
    })
    return { topicList: list.map(t => t.name), topicTree: tree }
  }, [dbTopics])

  const [selectedTopic, setSelectedTopic]       = useState(null)
  const [selectedSubtopic, setSelectedSubtopic] = useState(null)
  const [qualityFilter, setQualityFilter]       = useState(null)
  const [search, setSearch]                     = useState('')
  const [mobilePanel, setMobilePanel]           = useState('topics')

  // Auto-select first topic once loaded
  const effectiveSelectedTopic = selectedTopic || topicList[0] || null

  // ── Fetch revision data ───────────────────────────────────────────────────
  const { data: revisionData = {}, isLoading, isError } = useQuery({
    queryKey: ['revisionData', qualityFilter],
    queryFn: () => fetchRevisionData({ qualityFilter }),
    staleTime: 1000 * 60,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  // Apply the saved row to every cached revision view instead of refetching
  // all accepted submissions after each click.
  const patchRevisionRow = (saved) => {
    queryClient.setQueriesData({ queryKey: ['revisionData'] }, (grouped) => {
      if (!grouped) return grouped
      const next = {}
      for (const [topic, subs] of Object.entries(grouped)) {
        next[topic] = {}
        for (const [sub, rows] of Object.entries(subs)) {
          next[topic][sub] = rows.map((row) => (row.id === saved.id ? { ...row, ...saved } : row))
        }
      }
      return next
    })
  }

  const revisedMutation = useMutation({
    mutationFn: ({ id, val }) => toggleRevised(id, val),
    onSuccess: (saved, { val }) => {
      patchRevisionRow(saved)
      toast.success(val ? '✅ Marked as revised!' : 'Marked as not revised')
    },
    onError: () => toast.error('Failed to update'),
  })

  const qualityMutation = useMutation({
    mutationFn: ({ id, quality }) => updateQuality(id, quality),
    onSuccess: (saved) => {
      patchRevisionRow(saved)
      // A quality-filtered view may gain or lose this row, so only those refetch.
      queryClient.invalidateQueries({ queryKey: ['revisionData'], predicate: (q) => q.queryKey[1] != null })
    },
    onError: () => toast.error('Failed to update quality'),
  })

  // ── Subtopics for selected topic: DB subtopics + any extras from data ─────
  const subtopics = useMemo(() => {
    if (!effectiveSelectedTopic) return []
    const dbSubs = topicTree[effectiveSelectedTopic] || ['General']
    const fromData = Object.keys(revisionData[effectiveSelectedTopic] || {})
    const extras = fromData.filter(s => !dbSubs.includes(s))
    return [...dbSubs, ...extras]
  }, [effectiveSelectedTopic, revisionData, topicTree])

  // ── Problems for selected subtopic ────────────────────────────────────────
  const problems = useMemo(() => {
    if (!selectedSubtopic || !effectiveSelectedTopic) return []
    let list = (revisionData[effectiveSelectedTopic]?.[selectedSubtopic]) || []
    if (search) list = list.filter(p =>
      p.problem_title?.toLowerCase().includes(search.toLowerCase()) ||
      String(p.problem_id).includes(search)
    )
    return list
  }, [selectedSubtopic, effectiveSelectedTopic, revisionData, search])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const topicStats = useMemo(() => {
    if (!effectiveSelectedTopic) return { total: 0, revised: 0 }
    const allInTopic = Object.values(revisionData[effectiveSelectedTopic] || {}).flat()
    return { total: allInTopic.length, revised: allInTopic.filter(p => p.is_revised).length }
  }, [effectiveSelectedTopic, revisionData])

  const topicCounts = useMemo(() => {
    const counts = {}
    topicList.forEach(t => { counts[t] = Object.values(revisionData[t] || {}).flat().length })
    return counts
  }, [revisionData, topicList])

  const subtopicCounts = useMemo(() => {
    if (!effectiveSelectedTopic) return {}
    const counts = {}
    const topicData = revisionData[effectiveSelectedTopic] || {}
    subtopics.forEach(s => { counts[s] = (topicData[s] || []).length })
    return counts
  }, [effectiveSelectedTopic, revisionData, subtopics])

  const handleTopicSelect = useCallback((topic) => {
    setSelectedTopic(topic)
    setSelectedSubtopic(null)
    setSearch('')
    setMobilePanel('subtopics')
  }, [])

  const handleSubtopicSelect = useCallback((sub) => {
    setSelectedSubtopic(sub)
    setSearch('')
    setMobilePanel('problems')
  }, [])

  if (isError) {
    return <div className="p-8 text-center text-red-400">Failed to load revision data. Please refresh.</div>
  }

  // ── Empty state: no DB topics ─────────────────────────────────────────────
  if (!topicsLoading && topicList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Layers className="w-8 h-8 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">No Topics Yet</h2>
          <p className="text-sm text-zinc-400 max-w-sm">
            Create topics and subtopics to organize your revision (e.g. Array → Two Pointers).
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/topics-manager"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition">
            <Settings className="w-4 h-4" />Manage Topics
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden bg-zinc-950" style={{ height: 'calc(100vh - 64px)' }}>

      {/* Mobile breadcrumb nav */}
      <div className="md:hidden flex items-center gap-0 border-b border-zinc-800/60 bg-zinc-900/50 overflow-x-auto">
        <button onClick={() => setMobilePanel('topics')}
          className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition ${
            mobilePanel === 'topics' ? 'border-orange-500 text-orange-400' : 'border-transparent text-zinc-500'
          }`}>Topics</button>
        <span className="text-zinc-700 text-xs">›</span>
        <button onClick={() => setMobilePanel('subtopics')}
          className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition ${
            mobilePanel === 'subtopics' ? 'border-orange-500 text-orange-400' : 'border-transparent text-zinc-500'
          }`}>{effectiveSelectedTopic || 'Subtopics'}</button>
        {selectedSubtopic && (
          <>
            <span className="text-zinc-700 text-xs">›</span>
            <button onClick={() => setMobilePanel('problems')}
              className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition ${
                mobilePanel === 'problems' ? 'border-orange-500 text-orange-400' : 'border-transparent text-zinc-500'
              }`}>{selectedSubtopic}</button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ═══ LEFT PANE — Main Topics ═══ */}
        <aside className={`w-full md:w-52 flex-shrink-0 border-r border-zinc-800/60 flex flex-col bg-zinc-950 overflow-hidden ${
          mobilePanel === 'topics' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="px-3 py-3 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-white">Topics</span>
              <span className="text-xs text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">DB</span>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/topics-manager" className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-orange-400 transition" title="Manage topics">
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {topicsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5">
              {topicList.map((topic) => {
                const count = topicCounts[topic] || 0
                const isActive = effectiveSelectedTopic === topic
                return (
                  <button key={topic} onClick={() => handleTopicSelect(topic)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                    }`}>
                    <span className="truncate">{topic}</span>
                    {count > 0 && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${
                        isActive ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-500'
                      }`}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        {/* ═══ MIDDLE PANE — Subtopics ═══ */}
        <aside className={`w-full md:w-52 flex-shrink-0 border-r border-zinc-800/60 flex flex-col bg-zinc-950/50 overflow-hidden ${
          mobilePanel === 'subtopics' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="px-3 py-3 border-b border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {effectiveSelectedTopic || 'Select Topic'}
            </span>
            {topicStats.total > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${Math.round((topicStats.revised / topicStats.total) * 100)}%` }} />
                </div>
                <span className="text-xs text-zinc-500">{topicStats.revised}/{topicStats.total}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5">
            {subtopics.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center px-3 py-6">No subtopics. Select a topic or manage topics.</p>
            ) : subtopics.map((sub) => {
              const count = subtopicCounts[sub] || 0
              const isActive = selectedSubtopic === sub
              return (
                <button key={sub} onClick={() => handleSubtopicSelect(sub)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20 font-medium'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                  }`}>
                  <span className="truncate">{sub}</span>
                  {count > 0 && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${
                      isActive ? 'bg-orange-500/15 text-orange-400' : 'bg-zinc-800/80 text-zinc-600'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* ═══ RIGHT PANE — Problems ═══ */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-zinc-950 ${
          mobilePanel === 'problems' || !selectedSubtopic ? 'flex' : 'hidden md:flex'
        }`}>

          {!selectedSubtopic ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Select a Subtopic</h3>
                <p className="text-sm text-zinc-400 max-w-xs">
                  Choose a subtopic from the middle panel to see your solved problems with revision tracking.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex-shrink-0 px-3 sm:px-5 py-3 border-b border-zinc-800/60 flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-white">
                    {effectiveSelectedTopic} <span className="text-zinc-500 font-normal">›</span> {selectedSubtopic}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {problems.length} problem{problems.length !== 1 ? 's' : ''}
                    {problems.filter(p => p.is_revised).length > 0 && (
                      <> · <span className="text-emerald-400">{problems.filter(p => p.is_revised).length} revised</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                    <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 w-28 sm:w-32 transition" />
                  </div>
                  {/* Quality filter */}
                  <div className="flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-zinc-500" />
                    <select value={qualityFilter ?? ''}
                      onChange={e => setQualityFilter(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                      className="text-xs bg-zinc-900 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-orange-500/50 transition">
                      <option value="">All quality</option>
                      {QUALITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>≥ {opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Table header */}
              <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/50">
                <div className="w-4 flex-shrink-0" />
                <span className="text-xs font-medium text-zinc-600 hidden sm:block w-6 flex-shrink-0">#</span>
                <span className="text-xs font-medium text-zinc-600 hidden sm:block w-20 flex-shrink-0">LC No</span>
                <span className="text-xs font-medium text-zinc-600 flex-1">Title</span>
                <span className="text-xs font-medium text-zinc-600 w-16 hidden sm:block">Diff</span>
                <span className="text-xs font-medium text-zinc-600 w-16">Quality</span>
                <div className="w-16" />
              </div>

              {/* Problem list */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
                ) : problems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                    <Circle className="w-10 h-10 text-zinc-700" />
                    <p className="text-sm text-zinc-500">
                      {search || qualityFilter ? 'No problems match the filters.' : 'No problems solved in this subtopic yet.'}
                    </p>
                    {(search || qualityFilter) && (
                      <button onClick={() => { setSearch(''); setQualityFilter(null) }}
                        className="text-xs text-orange-400 hover:underline">Clear filters</button>
                    )}
                  </div>
                ) : (
                  problems.map((problem, idx) => (
                    <ProblemRow
                      key={problem.id}
                      problem={problem}
                      rowIndex={idx + 1}
                      onToggleRevised={(id, val) => revisedMutation.mutate({ id, val })}
                      onQualityChange={(id, quality) => qualityMutation.mutate({ id, quality })}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
