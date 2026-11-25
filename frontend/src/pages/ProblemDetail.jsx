/**
 * ProblemDetail.jsx
 *
 * Modularized problem detail page with split view, per-approach metadata,
 * block editor, code editor, alternate approaches, and PDF export.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import {
  ArrowLeft, ExternalLink, Save, Trash2, AlertTriangle,
  Code2, Loader2, GripVertical, FileDown,
  Zap, Database, Calendar, Tag,
} from 'lucide-react'
import {
  fetchSubmission, updateSubmission, deleteSubmission,
  removeAlternateCode,
} from '../lib/api'
import { groupPDFProblems } from '../lib/pdfGroups'
import LeftPanel from '../components/problem-detail/LeftPanel'
import { RightCodePanel, MobileCodePanel } from '../components/problem-detail/CodePanels'
import { AddAlternateModal, DeleteModal } from '../components/problem-detail/Modals'

// ─────────────────────────────────────────────────────────────────────────────
// Small UI atoms
// ─────────────────────────────────────────────────────────────────────────────
const DIFF_STYLES = {
  Easy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Medium: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/25',
  Hard:   'bg-red-500/15     text-red-400     border-red-500/25',
}
const EMPTY_ALTERNATES = []

function DiffBadge({ difficulty }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${DIFF_STYLES[difficulty] ?? 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40'}`}>
      {difficulty}
    </span>
  )
}

function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
      <Tag className="w-2.5 h-2.5 opacity-60" />{tag}
    </span>
  )
}

function normalizeLinks(...sources) {
  return [...new Set(sources.flat().filter(Boolean))]
}

function buildPrimaryMeta(sub) {
  return {
    runtime:     sub.runtime      || '',
    memory:      sub.memory       || '',
    notes:       sub.notes        || '',
    pageBlocks:  Array.isArray(sub.page_blocks) ? sub.page_blocks : [],
    chatgptUrls: normalizeLinks(sub.chatgpt_urls || [], sub.chatgpt_url),
    youtubeUrls: normalizeLinks(sub.youtube_urls || [], sub.youtube_url),
  }
}

function buildAltMeta(alt) {
  return {
    runtime:     alt.runtime     || '',
    memory:      alt.memory      || '',
    notes:       alt.notes       || '',
    pageBlocks:  Array.isArray(alt.page_blocks) ? alt.page_blocks : [],
    chatgptUrls: normalizeLinks(alt.chatgpt_urls || [], alt.chatgpt_url),
    youtubeUrls: normalizeLinks(alt.youtube_urls || [], alt.youtube_url),
  }
}

function withExportMeta(item, meta) {
  return {
    ...item,
    runtime: meta.runtime,
    memory: meta.memory,
    notes: meta.notes,
    page_blocks: meta.pageBlocks,
    chatgpt_urls: meta.chatgptUrls,
    chatgpt_url: null,
    youtube_urls: meta.youtubeUrls,
    youtube_url: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ProblemDetail — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ProblemDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [activeApproach, setActiveApproach]   = useState('primary')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAddAlternate, setShowAddAlternate] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  // Metas
  const [primaryMeta, setPrimaryMeta] = useState({ runtime: '', memory: '', notes: '', pageBlocks: [], chatgptUrls: [], youtubeUrls: [] })
  const [altMetas, setAltMetas]       = useState({})
  const [metaDirty, setMetaDirty]     = useState(false)

  // Resizable split
  const [splitPct, setSplitPct] = useState(45)
  const dragging     = useRef(false)
  const containerRef = useRef(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: submission, isLoading, isError, error } = useQuery({
    queryKey: ['submission', id],
    queryFn:  () => fetchSubmission(id),
    enabled:  !!id,
    staleTime: 1000 * 60 * 2,
    gcTime:    1000 * 60 * 10,
  })

  // Seed metas from DB on load
  useEffect(() => {
    if (!submission) return
    setPrimaryMeta(buildPrimaryMeta(submission))
    const am = {}
    ;(submission.alternate_codes || []).forEach(a => { am[a.id] = buildAltMeta(a) })
    setAltMetas(am)
    setMetaDirty(false)
  }, [submission])

  // ── Resize ─────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(e => {
    e.preventDefault(); dragging.current = true
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = e => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setSplitPct(Math.min(70, Math.max(25, ((e.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: payload => updateSubmission(id, payload),
    onSuccess: updated => {
      toast.success('Saved!')
      queryClient.setQueryData(['submission', id], updated)
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      setMetaDirty(false)
    },
    onError: err => toast.error(`Save failed: ${err?.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSubmission(id),
    onSuccess: () => {
      toast.success('Deleted.')
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      navigate('/problems', { replace: true })
    },
    onError: err => toast.error(`Delete failed: ${err?.message}`),
  })

  const removeAltMutation = useMutation({
    mutationFn: ({ altId }) => removeAlternateCode(id, altId),
    onSuccess: updated => { toast.success('Approach removed.'); queryClient.setQueryData(['submission', id], updated) },
    onError: err => toast.error(`Failed: ${err?.message}`),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const saveMetas = useCallback(() => {
    const alternates = (submission?.alternate_codes || []).map(a => {
      const m = altMetas[a.id] || {}
      return {
        ...a,
        runtime:     m.runtime     || null,
        memory:      m.memory      || null,
        notes:       m.notes       || null,
        page_blocks: m.pageBlocks  || [],
        chatgpt_url: m.chatgptUrls?.[0] || null,
        chatgpt_urls: m.chatgptUrls || [],
        youtube_url: m.youtubeUrls?.[0] || null,
        youtube_urls: m.youtubeUrls || [],
      }
    })
    updateMutation.mutate({
      runtime:      primaryMeta.runtime      || null,
      memory:       primaryMeta.memory       || null,
      notes:        primaryMeta.notes        || null,
      page_blocks:  primaryMeta.pageBlocks   || [],
      chatgpt_url:  primaryMeta.chatgptUrls?.[0] || null,
      chatgpt_urls: primaryMeta.chatgptUrls  || [],
      youtube_url:  primaryMeta.youtubeUrls?.[0] || null,
      youtube_urls: primaryMeta.youtubeUrls  || [],
      alternate_codes: alternates,
    })
  }, [submission, primaryMeta, altMetas, updateMutation])

  const handleAlternateAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['submission', id] })
    queryClient.invalidateQueries({ queryKey: ['submissions'] })
  }, [queryClient, id])

  const alternates = submission?.alternate_codes ?? EMPTY_ALTERNATES
  const language   = submission?.language || 'Unknown'
  const selectedAlternate = activeApproach === 'primary'
    ? null
    : alternates.find((alternate) => alternate.id === activeApproach)

  const activeMeta = selectedAlternate
    ? (altMetas[selectedAlternate.id] || buildAltMeta(selectedAlternate))
    : primaryMeta
  const activeApproachLabel = selectedAlternate?.label || (selectedAlternate ? 'Alternate approach' : 'Primary solution')

  useEffect(() => {
    if (activeApproach !== 'primary' && !alternates.some((alternate) => alternate.id === activeApproach)) {
      setActiveApproach('primary')
    }
  }, [activeApproach, alternates])

  const handlePrimaryMetaChange = useCallback((meta) => {
    setPrimaryMeta(meta)
    setMetaDirty(true)
  }, [])
  const handleAlternateMetaChange = useCallback((altId, meta) => {
    setAltMetas((previous) => ({ ...previous, [altId]: meta }))
    setMetaDirty(true)
  }, [])

  // Auto-save page_blocks to DB immediately (called after image upload)
  const handleSaveBlocks = useCallback(async (newBlocks) => {
    if (activeApproach === 'primary') {
      // Save primary page_blocks directly
      try { await updateSubmission(id, { page_blocks: newBlocks }) } catch (_) {}
    } else {
      // Save into the matching alternate_codes entry
      const updated = (submission?.alternate_codes || []).map((a) =>
        a.id === activeApproach ? { ...a, page_blocks: newBlocks } : a
      )
      try { await updateSubmission(id, { alternate_codes: updated }) } catch (_) {}
    }
  }, [id, activeApproach, submission])

  const updatePrimaryCode = useCallback(async newCode => {
    try { await updateSubmission(id, { code: newCode }); toast.success('Updated!'); queryClient.invalidateQueries({ queryKey: ['submission', id] }) }
    catch (err) { toast.error(`Failed: ${err?.message}`) }
  }, [id, queryClient])

  const updateAlternateCode = useCallback(async (altId, newCode, label) => {
    const updated = alternates.map((approach) => {
      if (approach.id !== altId) return approach
      const meta = altMetas[altId] || buildAltMeta(approach)
      return {
        ...approach,
        code: newCode,
        label,
        runtime: meta.runtime || null,
        memory: meta.memory || null,
        notes: meta.notes || null,
        chatgpt_url: meta.chatgptUrls?.[0] || null,
        chatgpt_urls: meta.chatgptUrls || [],
        youtube_url: meta.youtubeUrls?.[0] || null,
        youtube_urls: meta.youtubeUrls || [],
      }
    })
    try { await updateSubmission(id, { alternate_codes: updated }); toast.success('Updated!'); queryClient.invalidateQueries({ queryKey: ['submission', id] }) }
    catch (err) { toast.error(`Failed: ${err?.message}`) }
  }, [id, alternates, altMetas, queryClient])

  const deletePrimaryOrSolution = useCallback(async () => {
    if (alternates.length === 0) { setShowDeleteModal(true); return }
    try {
      const [first, ...rest] = alternates
      const firstMeta = altMetas[first.id] || {}
      const renumberedRest = rest.map((alt, idx) => {
        const label = alt.label ? alt.label.trim() : ''
        const isDefaultLabel = !label || /^(Alternate\s+)?(Approach|Code)\s+\d+$/i.test(label)
        return {
          ...alt,
          label: isDefaultLabel ? `Alternate Approach ${idx + 1}` : alt.label
        }
      })
      await updateSubmission(id, {
        code: first.code, language: first.language || language,
        runtime: firstMeta.runtime || null,
        memory:  firstMeta.memory  || null,
        notes:   firstMeta.notes   || null,
        page_blocks: firstMeta.pageBlocks || [],
        chatgpt_url: firstMeta.chatgptUrls?.[0] || null,
        chatgpt_urls: firstMeta.chatgptUrls || [],
        youtube_url: firstMeta.youtubeUrls?.[0] || null,
        youtube_urls: firstMeta.youtubeUrls || [],
        alternate_codes: renumberedRest,
      })
      toast.success('Approach 1 promoted to primary solution.')
      queryClient.invalidateQueries({ queryKey: ['submission', id] })
    } catch (err) { toast.error(`Failed: ${err?.message}`) }
  }, [id, alternates, altMetas, language, queryClient])

  const handleRemoveAlternate = useCallback((altId) => {
    setActiveApproach('primary')
    removeAltMutation.mutate({ altId })
  }, [removeAltMutation])

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true)
    try {
      const { downloadPDF } = await import('../lib/pdfExport')
      const problem = {
        ...withExportMeta(submission, primaryMeta),
        alternate_codes: alternates.map((alt) => withExportMeta(alt, altMetas[alt.id] || buildAltMeta(alt))),
      }
      const missing = await downloadPDF(groupPDFProblems([problem], []), { single: true })
      if (missing) toast(`Download started. ${missing} ${missing === 1 ? 'image was' : 'images were'} unavailable.`)
      else toast.success('PDF download started.')
    } catch (err) {
      toast.error(`PDF generation failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setDownloadingPDF(false)
    }
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
  if (isError || !submission) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <AlertTriangle className="w-10 h-10 text-red-400" />
      <p className="text-red-400 text-sm">{error?.message || 'Not found.'}</p>
      <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium transition hover:bg-zinc-700">Go Back</button>
    </div>
  )

  const title       = submission.problem_title || 'Untitled'
  const lcNum       = submission.problem_id
  const difficulty  = submission.difficulty
  const tags        = submission.tags ?? []
  const submittedAt = submission.submission_time || submission.created_at
  const description = submission.description
  const code        = submission.code || ''
  const leetcodeUrl = submission.url

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden bg-zinc-950 text-white" style={{ height: 'calc(100vh - 64px)' }}>

      {/* HEADER */}
      <header className="flex-shrink-0 bg-zinc-900/60 border-b border-zinc-800/60">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button onClick={() => navigate(-1)} className="flex-shrink-0 flex items-center gap-1.5 text-zinc-400 hover:text-white transition text-sm">
            <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {leetcodeUrl && (
              <a href={leetcodeUrl} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-xs font-medium text-orange-400 border border-orange-500/25 transition">
                <ExternalLink className="w-3 h-3" />LeetCode
              </a>
            )}
            {lcNum > 0 && <span className="flex-shrink-0 text-xs font-mono font-bold text-orange-400/80">#{lcNum}</span>}
            <h1 className="min-w-0 text-sm font-semibold text-white truncate">{title}</h1>
            {difficulty && <DiffBadge difficulty={difficulty} />}
            {language && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-300 border border-orange-500/20">
                <Code2 className="w-3 h-3" />{language}
              </span>
            )}
            {activeMeta.runtime && <span className="inline-flex items-center gap-1 text-xs text-purple-300"><Zap className="w-3 h-3" />{activeMeta.runtime}</span>}
            {activeMeta.memory && <span className="inline-flex items-center gap-1 text-xs text-blue-300"><Database className="w-3 h-3" />{activeMeta.memory}</span>}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {metaDirty && (
              <button onClick={saveMetas} disabled={updateMutation.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition disabled:opacity-60">
                <Save className="w-3.5 h-3.5" /><span className="hidden sm:inline">Save</span>
              </button>
            )}
            <button onClick={handleDownloadPDF} disabled={downloadingPDF} aria-label="Download PDF" aria-busy={downloadingPDF}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/30 text-xs font-medium transition disabled:opacity-60" title="Download PDF">
              {downloadingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span className="whitespace-nowrap">{downloadingPDF ? 'Preparing PDF…' : 'Download PDF'}</span>
            </button>
            <button onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-900/40 text-xs font-medium transition">
              <Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-2 border-t border-zinc-800/40 pt-1.5">
          <span className="text-xs text-zinc-600">Viewing: <span className="text-zinc-400">{activeApproachLabel}</span></span>
          {submittedAt && (
            <span className="flex items-center gap-1 text-zinc-500 text-xs">
              <Calendar className="w-3 h-3" />{format(new Date(submittedAt), 'MMM d, yyyy')}
            </span>
          )}
          {tags.length > 0 && <span className="text-zinc-700 text-xs">·</span>}
          {tags.slice(0, 6).map(t => <TagChip key={typeof t === 'string' ? t : t.name} tag={typeof t === 'string' ? t : t.name} />)}
          {tags.length > 6 && <span className="text-xs text-zinc-600">+{tags.length - 6}</span>}
        </div>
      </header>

      {/* MOBILE VIEW — Normal page scroll */}
      <div className="flex-1 overflow-y-auto md:hidden flex flex-col divide-y divide-zinc-800/60 bg-zinc-950">
        <div>
          <LeftPanel
            description={description}
            meta={activeMeta}
            onMetaChange={activeApproach === 'primary'
              ? handlePrimaryMetaChange
              : (meta) => handleAlternateMetaChange(activeApproach, meta)}
            approachLabel={activeApproachLabel}
            submissionId={id}
            onSaveBlocks={handleSaveBlocks}
          />
        </div>
        <div className="pb-8">
          <MobileCodePanel
            code={code} language={language} alternates={alternates}
            activeCode={activeApproach} onActiveCodeChange={setActiveApproach}
            onAddAlternate={() => setShowAddAlternate(true)}
            onRemoveAlternate={handleRemoveAlternate}
            onUpdatePrimary={updatePrimaryCode}
            onUpdateAlternate={updateAlternateCode}
            onDeleteSolution={deletePrimaryOrSolution}
          />
        </div>
      </div>

      {/* DESKTOP SPLIT VIEW */}
      <div ref={containerRef} className="flex-1 overflow-hidden hidden md:flex">
        <div className="flex flex-col overflow-hidden border-r border-zinc-800/60" style={{ width: `${splitPct}%` }}>
          <LeftPanel
            description={description}
            meta={activeMeta}
            onMetaChange={activeApproach === 'primary'
              ? handlePrimaryMetaChange
              : (meta) => handleAlternateMetaChange(activeApproach, meta)}
            approachLabel={activeApproachLabel}
            submissionId={id}
            onSaveBlocks={handleSaveBlocks}
          />
        </div>

        <div className="flex-shrink-0 w-1 hover:w-1.5 bg-zinc-800/60 hover:bg-orange-500/50 cursor-col-resize flex items-center justify-center transition-all group" onMouseDown={handleMouseDown}>
          <GripVertical className="w-3 h-3 text-zinc-600 group-hover:text-orange-400 opacity-0 group-hover:opacity-100 transition" />
        </div>

        <div className="flex flex-col overflow-hidden" style={{ width: `${100 - splitPct}%` }}>
          <RightCodePanel
            code={code} language={language} alternates={alternates}
            activeCode={activeApproach} onActiveCodeChange={setActiveApproach}
            onAddAlternate={() => setShowAddAlternate(true)}
            onRemoveAlternate={handleRemoveAlternate}
            onUpdatePrimary={updatePrimaryCode}
            onUpdateAlternate={updateAlternateCode}
            onDeleteSolution={deletePrimaryOrSolution}
          />
        </div>
      </div>

      {/* MODALS */}
      {showAddAlternate && <AddAlternateModal submissionId={id} language={language} onClose={() => setShowAddAlternate(false)} onSuccess={handleAlternateAdded} />}
      {showDeleteModal  && <DeleteModal title={title} isDeleting={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate()} onCancel={() => setShowDeleteModal(false)} />}
    </div>
  )
}
