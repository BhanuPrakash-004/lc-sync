/**
 * DownloadPDF.jsx — Advanced PDF Export Page
 *
 * Features:
 *  - Select by whole topic, whole subtopic, selected questions, or all questions
 *  - Live preview of what will be exported
 *  - Rich PDF: description, all approach codes, notes, links (ChatGPT, YouTube, LeetCode)
 *  - Progress feedback during data fetch + generation
 *  - Dark glassmorphism UI matching the LC Sync design system
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  FileDown,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  BookOpen,
  Layers,
  ListChecks,
  Sparkles,
  X,
  Code2,
  StickyNote,
  FileText,
  Link2,
  AlertCircle,
  Search,
  SquareCheck,
  Square,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchCustomTopics } from '../lib/api'
import { groupPDFProblems, subtopicKey } from '../lib/pdfGroups'

const EMPTY = []
const DIFF_BG = { Easy: '#d1fae5', Medium: '#fef9c3', Hard: '#fee2e2' }
const DIFF_TEXT = { Easy: '#065f46', Medium: '#92400e', Hard: '#991b1b' }

async function fetchAllProblems() {
  const problems = []
  let lastId
  while (true) {
    let query = supabase
      .from('submissions')
      .select('id,problem_id,problem_title,difficulty,user_topic,user_subtopic,subtopic,tags')
      .eq('is_accepted', true)
      .order('id', { ascending: true })
      .limit(500)
    if (lastId) query = query.gt('id', lastId)
    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break
    problems.push(...data)
    lastId = data.at(-1).id
  }
  return problems.sort((a, b) => a.problem_id - b.problem_id || a.problem_title.localeCompare(b.problem_title))
}

async function fetchFullSubmissions(ids) {
  const { data, error } = await supabase.from('submissions').select('*').in('id', ids)
  if (error) throw error
  return data || []
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionCard({ icon: Icon, color = 'orange', title, description, children, active, onClick }) {
  const colors = {
    orange: { ring: 'border-orange-500/50 bg-orange-500/5', icon: 'text-orange-400 bg-orange-500/10', dot: 'bg-orange-500' },
    blue:   { ring: 'border-blue-500/50 bg-blue-500/5',   icon: 'text-blue-400 bg-blue-500/10',   dot: 'bg-blue-500'   },
    violet: { ring: 'border-violet-500/50 bg-violet-500/5',icon: 'text-violet-400 bg-violet-500/10',dot: 'bg-violet-500'},
    emerald:{ ring: 'border-emerald-500/50 bg-emerald-500/5',icon:'text-emerald-400 bg-emerald-500/10',dot:'bg-emerald-500'},
  }
  const c = colors[color] || colors.orange

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl border p-5 cursor-pointer transition-all duration-200 select-none ${
        active
          ? `${c.ring} shadow-lg shadow-${color}-500/10`
          : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/60 hover:bg-zinc-900/60'
      }`}
    >
      {active && (
        <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${c.dot} shadow-[0_0_6px_2px_rgba(249,115,22,0.5)]`} />
      )}
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 p-2.5 rounded-xl ${active ? c.icon : 'bg-zinc-800/60 text-zinc-500'} transition-colors`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={`font-semibold text-sm ${active ? 'text-white' : 'text-zinc-300'}`}>{title}</p>
          <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {active && children && (
        <div className="mt-4 border-t border-white/5 pt-4" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  )
}

function ProblemCheckItem({ sub, checked, onToggle }) {
  const diff = sub.difficulty
  return (
    <div
      onClick={() => onToggle(sub.id)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        checked ? 'bg-orange-500/8 border border-orange-500/20' : 'hover:bg-zinc-800/50 border border-transparent'
      }`}
    >
      <div className={`flex-shrink-0 ${checked ? 'text-orange-400' : 'text-zinc-600'} transition-colors`}>
        {checked ? <SquareCheck className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${checked ? 'text-white' : 'text-zinc-300'}`}>
          {sub.problem_id > 0 && (
            <span className="text-orange-400/70 font-mono text-xs mr-1.5">#{sub.problem_id}</span>
          )}
          {sub.problem_title}
        </p>
        {(sub.user_topic || sub.subtopic || sub.user_subtopic) && (
          <p className="text-[10px] text-zinc-600 mt-0.5 truncate">
            {[sub.user_topic, sub.subtopic || sub.user_subtopic].filter(Boolean).join(' › ')}
          </p>
        )}
      </div>
      <span
        className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: DIFF_BG[diff] || '#f3f4f6', color: DIFF_TEXT[diff] || '#374151' }}
      >
        {diff}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DownloadPDF() {
  const [mode, setMode] = useState(null) // 'all' | 'topic' | 'subtopic' | 'selected'
  const [selectedTopics, setSelectedTopics]   = useState([])   // topic names
  const [selectedSubtopics, setSelectedSubtopics] = useState([])
  const [selectedIds, setSelectedIds]         = useState(new Set())
  const [generating, setGenerating]           = useState(false)
  const [progress, setProgress]               = useState('')
  const [searchQ, setSearchQ]                 = useState('')
  const [expandedTopics, setExpandedTopics]   = useState({})

  // Data queries
  const { data: topics = EMPTY, isLoading: topicsLoading, isError: topicsError } = useQuery({
    queryKey: ['pdf-topics'],
    queryFn: fetchCustomTopics,
    staleTime: 1000 * 60 * 5,
  })

  const { data: allProblems = EMPTY, isLoading: problemsLoading, isError: problemsError } = useQuery({
    queryKey: ['pdf-problems'],
    queryFn: fetchAllProblems,
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = topicsLoading || problemsLoading

  const groups = useMemo(() => groupPDFProblems(allProblems, topics), [allProblems, topics])
  const allTopicsSelected = groups.length > 0 && groups.every((topic) => selectedTopics.includes(topic.name))

  // Filtered problems for 'selected' mode
  const q = searchQ.toLowerCase()
  const filteredProblems = allProblems.filter((p) => {
    if (!q) return true
    return (
      p.problem_title.toLowerCase().includes(q) ||
      String(p.problem_id).includes(q) ||
      (p.user_topic || '').toLowerCase().includes(q) ||
      (p.subtopic || p.user_subtopic || '').toLowerCase().includes(q)
    )
  })

  const selectedGroups = useMemo(() => {
    if (!mode) return EMPTY
    if (mode === 'all') return groups
    if (mode === 'topic') return groups.filter((topic) => selectedTopics.includes(topic.name))
    return groups.flatMap((topic) => {
      const subtopics = mode === 'subtopic'
        ? topic.subtopics.filter((section) => selectedSubtopics.includes(subtopicKey(topic.name, section.name)))
        : topic.subtopics
            .map((section) => ({ ...section, problems: section.problems.filter((problem) => selectedIds.has(problem.id)) }))
            .filter((section) => section.problems.length > 0)
      return subtopics.length ? [{ ...topic, subtopics }] : []
    })
  }, [mode, groups, selectedTopics, selectedSubtopics, selectedIds])
  const exportProblems = useMemo(() => selectedGroups.flatMap((topic) =>
    topic.subtopics.flatMap((section) => section.problems)
  ), [selectedGroups])
  const previewCount = exportProblems.length

  // Toggle helpers
  const toggleTopic = (name) =>
    setSelectedTopics((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )

  const toggleSubtopic = (key) =>
    setSelectedSubtopics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )

  const toggleId = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAllVisible = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredProblems.forEach((p) => next.add(p.id))
      return next
    })

  const clearAll = () => setSelectedIds(new Set())

  const toggleExpandTopic = (name) =>
    setExpandedTopics((prev) => ({ ...prev, [name]: !prev[name] }))

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (generating || !previewCount) return
    setGenerating(true)
    try {
      setProgress(`Loading 0 / ${previewCount}…`)
      const targetIds = exportProblems.map((problem) => problem.id)
      const fullById = new Map()
      const CHUNK = 50
      const [{ downloadPDF }] = await Promise.all([
        import('../lib/pdfExport'),
        (async () => {
          for (let i = 0; i < targetIds.length; i += CHUNK) {
            const rows = await fetchFullSubmissions(targetIds.slice(i, i + CHUNK))
            for (const row of rows) fullById.set(row.id, row)
            setProgress(`Loading ${fullById.size} / ${previewCount}…`)
          }
        })(),
      ])
      if (fullById.size !== previewCount) throw new Error('Some selected submissions are no longer available.')

      const book = selectedGroups.map((topic) => ({
        ...topic,
        subtopics: topic.subtopics.map((section) => ({
          ...section,
          problems: section.problems.map(({ id }) => fullById.get(id)),
        })),
      }))
      const missing = await downloadPDF(book, { onProgress: setProgress })
      if (missing) toast(`Download started. ${missing} ${missing === 1 ? 'image was' : 'images were'} unavailable.`)
      else toast.success('PDF download started.')
    } catch (err) {
      toast.error(`PDF generation failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <FileDown className="w-6 h-6 text-orange-400" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Download PDF</h1>
            </div>
            <p className="text-zinc-400 text-sm ml-14">
              Export a study guide organized by topic and subtopic, with solutions, notes, and illustrations.
            </p>
          </div>
          {previewCount > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-orange-300 font-semibold text-sm">{previewCount} problems</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            <span className="text-sm">Loading your problems…</span>
          </div>
        ) : topicsError || problemsError ? (
          <p role="alert" className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 text-zinc-300">
            Could not load the export data. Refresh the page to try again.
          </p>
        ) : allProblems.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-12 text-center">
            <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No accepted submissions found.</p>
            <p className="text-zinc-600 text-xs mt-1">Install the Chrome extension and sync your LeetCode solutions first.</p>
          </div>
        ) : (
          <>
            {/* ── Step 1: Pick Mode ───────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">1</span>
                <h2 className="text-base font-semibold text-white">Choose Export Scope</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* All Problems */}
                <SectionCard
                  icon={ListChecks}
                  color="emerald"
                  title="All Problems"
                  description={`Export every accepted solution (${allProblems.length} total)`}
                  active={mode === 'all'}
                  onClick={() => setMode('all')}
                />

                {/* Whole Topic */}
                <SectionCard
                  icon={BookOpen}
                  color="orange"
                  title="Whole Topic(s)"
                  description="Pick one or more topics and export all their problems"
                  active={mode === 'topic'}
                  onClick={() => setMode('topic')}
                >
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTopics(groups.map((topic) => topic.name))}
                      disabled={allTopicsSelected}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-orange-300 bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-50"
                    >
                      Select all topics
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTopics([])}
                      disabled={selectedTopics.length === 0}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                    >
                      Clear topics
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {groups.map((t) => {
                      const isSelected = selectedTopics.includes(t.name)
                      return (
                        <button
                          type="button"
                          key={t.name}
                          aria-pressed={isSelected}
                          onClick={() => toggleTopic(t.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-orange-500/15 border border-orange-500/30'
                              : 'hover:bg-zinc-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`flex-shrink-0 ${isSelected ? 'text-orange-400' : 'text-zinc-600'}`}>
                              {isSelected ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded border border-zinc-700" />}
                            </div>
                            <span className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-zinc-300'}`}>{t.name}</span>
                          </div>
                          <span className="text-[10px] text-zinc-600 ml-2 flex-shrink-0">{t.count}</span>
                        </button>
                      )
                    })}
                  </div>
                </SectionCard>

                {/* Subtopic */}
                <SectionCard
                  icon={Layers}
                  color="blue"
                  title="Whole Subtopic(s)"
                  description="Pick specific subtopics from any topic"
                  active={mode === 'subtopic'}
                  onClick={() => setMode('subtopic')}
                >
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {groups.map((t) => {
                      const hasExpanded = expandedTopics[t.name]
                      const anySelected = t.subtopics.some(({ name }) => selectedSubtopics.includes(subtopicKey(t.name, name)))

                      return (
                        <div key={t.name}>
                          <button
                            type="button"
                            aria-expanded={Boolean(hasExpanded)}
                            onClick={() => toggleExpandTopic(t.name)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition text-left ${anySelected ? 'text-blue-300' : 'text-zinc-400'}`}
                          >
                            <span className="text-xs font-semibold uppercase tracking-wide">{t.name}</span>
                            {hasExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          {hasExpanded && (
                            <div className="ml-3 mt-1 space-y-1">
                              {t.subtopics.map((section) => {
                                const key = subtopicKey(t.name, section.name)
                                const isSel = selectedSubtopics.includes(key)
                                return (
                                  <button
                                    type="button"
                                    key={key}
                                    aria-pressed={isSel}
                                    onClick={() => toggleSubtopic(key)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                      isSel
                                        ? 'bg-blue-500/15 border border-blue-500/30'
                                        : 'hover:bg-zinc-800/60 border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`flex-shrink-0 ${isSel ? 'text-blue-400' : 'text-zinc-600'}`}>
                                        {isSel ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded border border-zinc-700" />}
                                      </div>
                                      <span className={`text-xs truncate ${isSel ? 'text-white font-medium' : 'text-zinc-300'}`}>{section.name}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 ml-2 flex-shrink-0">{section.problems.length}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>

                {/* Selected Questions */}
                <SectionCard
                  icon={Code2}
                  color="violet"
                  title="Selected Questions"
                  description="Hand-pick individual problems for the PDF"
                  active={mode === 'selected'}
                  onClick={() => setMode('selected')}
                >
                  {/* Search + bulk actions */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQ}
                          onChange={(e) => setSearchQ(e.target.value)}
                          placeholder="Search problems…"
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-zinc-800 border border-zinc-700/50 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                        />
                        {searchQ && (
                          <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={selectAllVisible}
                        className="px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 text-xs font-medium border border-violet-500/25 hover:bg-violet-500/25 transition"
                      >
                        All
                      </button>
                      {selectedIds.size > 0 && (
                        <button
                          onClick={clearAll}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-medium border border-zinc-700/50 hover:text-zinc-200 transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {selectedIds.size > 0 && (
                      <div className="text-xs text-violet-400 font-medium px-1">
                        ✓ {selectedIds.size} problem{selectedIds.size !== 1 ? 's' : ''} selected
                      </div>
                    )}

                    <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                      {filteredProblems.length === 0 ? (
                        <p className="text-zinc-600 text-xs py-4 text-center">No problems found</p>
                      ) : (
                        filteredProblems.map((p) => (
                          <ProblemCheckItem
                            key={p.id}
                            sub={p}
                            checked={selectedIds.has(p.id)}
                            onToggle={toggleId}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            {/* ── Step 2: What's included ─────────────────────────────────── */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">2</span>
                <h2 className="text-base font-semibold text-white">PDF Contents</h2>
                <span className="text-xs text-zinc-600 ml-1">— everything is auto-included</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { icon: FileText,    label: 'Descriptions & Illustrations', color: 'text-emerald-400 bg-emerald-500/10' },
                  { icon: Code2,       label: 'Primary Solution Code', color: 'text-orange-400 bg-orange-500/10' },
                  { icon: Layers,      label: 'All Alternate Approaches', color: 'text-blue-400 bg-blue-500/10' },
                  { icon: StickyNote,  label: 'Notes (Main + Per-Approach)', color: 'text-yellow-400 bg-yellow-500/10' },
                  { icon: Link2,       label: 'LeetCode / ChatGPT / YouTube Links', color: 'text-violet-400 bg-violet-500/10' },
                  { icon: ListChecks,  label: 'Table of Contents & Page Numbers', color: 'text-zinc-400 bg-zinc-700/50' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/60">
                    <div className={`flex-shrink-0 p-1.5 rounded-lg ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs text-zinc-300 leading-snug">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Step 3: Generate ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">3</span>
                <div>
                  <h2 className="text-base font-semibold text-white">Download Study Guide</h2>
                  {previewCount > 0 ? (
                    <p className="text-zinc-400 text-xs mt-0.5">
                      <span className="text-orange-400 font-semibold">{previewCount}</span> problem{previewCount !== 1 ? 's' : ''} will be exported
                    </p>
                  ) : (
                    <p className="text-zinc-600 text-xs mt-0.5">Select a scope above to preview</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !mode || previewCount === 0}
                aria-label="Download PDF"
                aria-busy={generating}
                className={`
                  flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200
                  ${generating || !mode || previewCount === 0
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 border border-orange-400/30'
                  }
                `}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progress || 'Generating…'}</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Download PDF</span>
                    {previewCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold">
                        {previewCount > 99 ? '99+' : previewCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

          </>
        )}
      </div>
    </div>
  )
}
