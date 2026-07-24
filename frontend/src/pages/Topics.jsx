/**
 * Topics.jsx
 * -----------
 * Striver-sheet style topic-based view.
 * Left: collapsible list of all topics with question counts.
 * Right: table of questions under the selected topic.
 */

import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchTopics } from '../lib/api'
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Circle,
  Search,
  Code2,
  Layers,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DIFF_STYLES = {
  Easy:   { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  Medium: { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',   dot: 'bg-yellow-400'  },
  Hard:   { badge: 'bg-red-500/15 text-red-400 border-red-500/25',            dot: 'bg-red-400'     },
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
const RowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-3"><div className="h-3 bg-zinc-800 rounded w-6" /></td>
    <td className="px-4 py-3"><div className="h-3 bg-zinc-800 rounded w-48" /></td>
    <td className="px-4 py-3"><div className="h-4 bg-zinc-800 rounded-full w-14" /></td>
    <td className="px-4 py-3"><div className="h-3 bg-zinc-800 rounded w-16" /></td>
    <td className="px-4 py-3"><div className="h-3 bg-zinc-800 rounded w-12" /></td>
  </tr>
)

// ---------------------------------------------------------------------------
// DiffBadge
// ---------------------------------------------------------------------------
function DiffBadge({ difficulty }) {
  const s = DIFF_STYLES[difficulty]
  if (!s) return <span className="text-xs text-zinc-500">{difficulty || '—'}</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {difficulty}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Topic sidebar item
// ---------------------------------------------------------------------------
function TopicItem({ name, count, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col px-3 py-2 rounded-lg text-left transition-all duration-150 ${
        isActive
          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
      }`}
    >
      {/* Top row: name + count badge */}
      <div className="flex items-center justify-between w-full">
        <span className="flex items-center gap-2 text-sm font-medium truncate">
          <span className="truncate">{name}</span>
        </span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ml-2 ${
          isActive ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-500'
        }`}>
          {count}
        </span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Question row
// ---------------------------------------------------------------------------
function QuestionRow({ submission, onOpen }) {
  const title = submission.problem_title || 'Untitled'
  const num   = submission.problem_id
  const diff  = submission.difficulty
  const lang  = submission.language

  return (
    <tr
      className="group border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
      onClick={() => onOpen(submission.id)}
    >
      {/* Status — always solved since we only store accepted */}
      <td className="px-4 py-3 w-10">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      </td>

      {/* # */}
      <td className="px-2 py-3 w-14">
        <span className="text-xs font-mono text-zinc-500">{num ? `#${num}` : '—'}</span>
      </td>

      {/* Title */}
      <td className="px-2 py-3">
        <span className="text-sm font-medium text-zinc-100 group-hover:text-white transition-colors">
          {title}
        </span>
      </td>

      {/* Difficulty */}
      <td className="px-2 py-3 hidden sm:table-cell w-28">
        <DiffBadge difficulty={diff} />
      </td>

      {/* Language */}
      <td className="px-2 py-3 hidden md:table-cell w-24">
        <span className="flex items-center gap-1 text-xs text-orange-400">
          <Code2 className="w-3 h-3" />
          {lang}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-20 text-right">
        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {submission.url && (
            <a
              href={submission.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
              title="Open on LeetCode"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <span className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Topics Page
// ---------------------------------------------------------------------------
export default function Topics() {
  const { topic: urlTopic } = useParams()
  const navigate = useNavigate()

  const [selectedTopic, setSelectedTopic] = useState(urlTopic || null)
  const [topicSearch, setTopicSearch] = useState('')
  const [diffFilter, setDiffFilter] = useState('All')
  const [qSearch, setQSearch] = useState('')

  const {
    data: topicsMap,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
    staleTime: 1000 * 60 * 2,
  })

  // Sorted topic list
  const topicList = useMemo(() => {
    if (!topicsMap) return []
    return Object.entries(topicsMap)
      .map(([name, questions]) => ({ name, count: questions.length }))
      .filter((t) => !topicSearch || t.name.toLowerCase().includes(topicSearch.toLowerCase()))
  }, [topicsMap, topicSearch])

  // Questions for selected topic
  const questions = useMemo(() => {
    if (!selectedTopic || !topicsMap) return []
    let list = topicsMap[selectedTopic] || []
    if (diffFilter !== 'All') list = list.filter((q) => q.difficulty === diffFilter)
    if (qSearch) list = list.filter((q) => q.problem_title?.toLowerCase().includes(qSearch.toLowerCase()))
    return list
  }, [selectedTopic, topicsMap, diffFilter, qSearch])

  const handleSelectTopic = (name) => {
    setSelectedTopic(name)
    setDiffFilter('All')
    setQSearch('')
    navigate(`/topics/${encodeURIComponent(name)}`, { replace: true })
  }

  const handleOpenProblem = (id) => {
    navigate(`/problems/${id}`)
  }

  const diffCounts = useMemo(() => {
    if (!selectedTopic || !topicsMap) return {}
    const list = topicsMap[selectedTopic] || []
    return list.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1
      return acc
    }, {})
  }, [selectedTopic, topicsMap])

  if (isError) {
    return (
      <div className="p-8 text-center text-red-400">
        Failed to load topics. Please refresh.
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── LEFT: Topic Sidebar ──────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-zinc-800/60 flex flex-col bg-zinc-950 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Topics</h2>
            {!isLoading && (
              <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                {topicList.length}
              </span>
            )}
          </div>

          {/* Summary: started topics + total problems */}
          {!isLoading && topicsMap && (() => {
            const allTopics = Object.keys(topicsMap)
            const started = allTopics.filter((k) => (topicsMap[k]?.length || 0) > 0).length
            const total = allTopics.reduce((s, k) => s + (topicsMap[k]?.length || 0), 0)
            return (
              <div className="flex items-center gap-3 mb-3 text-xs text-zinc-500">
                <span>
                  <span className="text-orange-400 font-semibold">{started}</span>
                  <span className="text-zinc-600"> / {allTopics.length} started</span>
                </span>
                <span className="w-px h-3 bg-zinc-700" />
                <span>
                  <span className="text-zinc-300 font-semibold">{total}</span> problems
                </span>
              </div>
            )
          })()}

          {/* Topic search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter topics…"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition"
            />
          </div>
        </div>

        {/* Topic list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-2 px-3 py-2">
                <div className="h-3 bg-zinc-800 rounded flex-1" />
                <div className="h-4 bg-zinc-800 rounded w-6" />
              </div>
            ))
          ) : topicList.length === 0 ? (
            <p className="text-center text-xs text-zinc-600 py-8">No topics found</p>
          ) : (
            topicList.map((t) => (
              <TopicItem
                key={t.name}
                name={t.name}
                count={t.count}
                isActive={selectedTopic === t.name}
                onClick={() => handleSelectTopic(t.name)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── RIGHT: Questions Panel ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {!selectedTopic ? (
          // Empty state
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Select a Topic</h3>
              <p className="text-sm text-zinc-400 max-w-xs">
                Choose a topic from the left sidebar to see all your solved problems in that category.
              </p>
            </div>
            {!isLoading && topicsMap && Object.keys(topicsMap).length === 0 && (
              <p className="text-xs text-zinc-500">
                No problems saved yet.{' '}
                <Link to="/problems" className="text-orange-400 hover:underline">
                  View all problems
                </Link>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Topic header */}
            <div className="px-6 py-4 border-b border-zinc-800/60 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{selectedTopic}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-400">
                    <span className="font-semibold text-white">{(topicsMap?.[selectedTopic] || []).length}</span> solved
                  </span>
                  {Object.entries(diffCounts).map(([d, c]) => (
                    <span key={d} className={`text-xs font-medium ${DIFF_STYLES[d]?.badge?.split(' ')?.[1] || 'text-zinc-400'}`}>
                      {c} {d}
                    </span>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {/* Difficulty filter */}
                <div className="flex rounded-lg border border-zinc-700/50 overflow-hidden">
                  {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiffFilter(d)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        diffFilter === d
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Search within topic */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 w-32 transition"
                  />
                </div>
              </div>
            </div>

            {/* Questions table */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <table className="w-full">
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
                  </tbody>
                </table>
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                  <Circle className="w-10 h-10 text-zinc-700" />
                  <p className="text-sm text-zinc-500">
                    {diffFilter !== 'All' || qSearch
                      ? 'No problems match the current filters.'
                      : 'No problems in this topic yet.'}
                  </p>
                  {(diffFilter !== 'All' || qSearch) && (
                    <button
                      onClick={() => { setDiffFilter('All'); setQSearch('') }}
                      className="text-xs text-orange-400 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm">
                    <tr className="border-b border-zinc-800/60">
                      <th className="px-4 py-2.5 text-left w-10" />
                      <th className="px-2 py-2.5 text-left w-14">
                        <span className="text-xs font-medium text-zinc-500">#</span>
                      </th>
                      <th className="px-2 py-2.5 text-left">
                        <span className="text-xs font-medium text-zinc-500">Title</span>
                      </th>
                      <th className="px-2 py-2.5 text-left hidden sm:table-cell w-28">
                        <span className="text-xs font-medium text-zinc-500">Difficulty</span>
                      </th>
                      <th className="px-2 py-2.5 text-left hidden md:table-cell w-24">
                        <span className="text-xs font-medium text-zinc-500">Language</span>
                      </th>
                      <th className="px-4 py-2.5 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <QuestionRow
                        key={q.id}
                        submission={q}
                        onOpen={handleOpenProblem}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
