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

// ─────────────────────────────────────────────────────────────────────────────
// PDF Export Helper
// ─────────────────────────────────────────────────────────────────────────────
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function renderDescriptionHTML(description) {
  if (!description || !description.trim()) return ''
  const isHtml = /<[a-z][\s\S]*>/i.test(description) || description.trimStart().startsWith('<')
  if (isHtml) {
    const processed = description.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (!/referrerpolicy/i.test(attrs)) {
        return `<img${attrs} referrerpolicy="no-referrer">`
      }
      return match
    })
    return `<div class="desc-section"><h2>📄 Problem Description</h2><div class="desc-content">${processed}</div></div>`
  }
  return `<div class="desc-section"><h2>📄 Problem Description</h2><div class="desc-content"><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;margin:0;">${esc(description)}</pre></div></div>`
}

function renderPageBlocksHTML(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return ''
  return blocks
    .map((b) => {
      if (!b) return ''
      const content = b.content || ''
      if (b.type === 'h1') return `<h2 style="font-size:16px;font-weight:700;margin:14px 0 6px;color:#1e293b;">${esc(content)}</h2>`
      if (b.type === 'h2') return `<h3 style="font-size:15px;font-weight:700;margin:12px 0 6px;color:#1e293b;">${esc(content)}</h3>`
      if (b.type === 'h3') return `<h4 style="font-size:14px;font-weight:600;margin:10px 0 4px;color:#334155;">${esc(content)}</h4>`
      if (b.type === 'text') return content ? `<p style="margin:6px 0;line-height:1.6;color:#334155;white-space:pre-wrap;">${esc(content)}</p>` : ''
      if (b.type === 'bullet') return `<div style="margin:4px 0;padding-left:12px;color:#334155;">• ${esc(content)}</div>`
      if (b.type === 'todo')
        return `<div style="margin:4px 0;color:#334155;">${b.checked ? '☑' : '☐'} <span style="${b.checked ? 'text-decoration:line-through;color:#9ca3af;' : ''}">${esc(content)}</span></div>`
      if (b.type === 'code')
        return `<div class="code-block" style="margin:10px 0;"><div class="code-label">${esc((b.language || 'code').toUpperCase())}</div><pre><code class="language-${esc((b.language||'plaintext').toLowerCase())}">${esc(content)}</code></pre></div>`
      if (b.type === 'image') {
        if (!content) return ''
        return `
          <div style="margin:14px 0;text-align:center;page-break-inside:avoid;">
            <img src="${esc(content)}" alt="${esc(b.caption || 'Image')}" referrerpolicy="no-referrer" crossorigin="anonymous" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0;box-shadow:0 2px 4px rgba(0,0,0,0.05);display:inline-block;" />
            ${b.caption ? `<div style="font-size:11px;color:#64748b;font-style:italic;margin-top:4px;">${esc(b.caption)}</div>` : ''}
          </div>`
      }
      if (b.type === 'link') {
        return `<div style="margin:6px 0;"><a href="${esc(b.url || '#')}" style="color:#f97316;text-decoration:none;font-weight:600;font-size:12px;">🔗 ${esc(b.title || b.url)}</a></div>`
      }
      if (b.type === 'chatgpt') {
        return `<div style="margin:6px 0;"><a href="${esc(b.url || '#')}" style="color:#10b981;text-decoration:none;font-weight:600;font-size:12px;">💬 ${esc(b.title || 'ChatGPT Discussion')}</a></div>`
      }
      if (b.type === 'callout')
        return `<div class="callout" style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;margin:10px 0;border-radius:4px;color:#92400e;">${esc(b.icon || '💡')} ${esc(content)}</div>`
      if (b.type === 'divider') return '<hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;" />'
      return content ? `<p style="margin:6px 0;color:#334155;">${esc(content)}</p>` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function generatePDF(submission, primaryMeta, altMetas) {
  const title       = submission.problem_title || 'Problem'
  const lcNum       = submission.problem_id > 0 ? `LC #${submission.problem_id}` : ''
  const difficulty  = submission.difficulty || ''
  const language    = submission.language || ''
  const alternates  = submission.alternate_codes || []
  const description = submission.description || ''
  const leetcodeUrl = submission.url || ''
  const tags        = submission.tags || []

  const codeBlock = (sectionLabel, lang, codeStr, meta) => {
    const cgLinks = meta?.chatgptUrls?.filter(Boolean) || []
    const ytLinks = meta?.youtubeUrls?.filter(Boolean) || []
    const blocksHtml = renderPageBlocksHTML(meta?.pageBlocks)
    const plainNotes = meta?.notes ? `<p style="white-space:pre-wrap;margin:4px 0;">${esc(meta.notes)}</p>` : ''

    return `
    <div class="code-block">
      <div class="code-label">${esc(sectionLabel)} <span class="lang-badge">${esc(lang)}</span>
        ${meta?.runtime ? `<span class="perf-badge">⚡ ${esc(meta.runtime)}</span>` : ''}
        ${meta?.memory  ? `<span class="perf-badge">📦 ${esc(meta.memory)}</span>`  : ''}
      </div>
      ${(blocksHtml || plainNotes) ? `<div class="approach-note">📝 <strong>Notes &amp; Blocks</strong>${plainNotes}${blocksHtml}</div>` : ''}
      ${cgLinks.map((u, i) => `<div class="link-item"><a href="${esc(u)}">💬 ChatGPT${cgLinks.length > 1 ? ` ${i+1}` : ''}</a></div>`).join('')}
      ${ytLinks.map((u, i) => `<div class="link-item"><a href="${esc(u)}">▶ YouTube${ytLinks.length > 1 ? ` ${i+1}` : ''}</a></div>`).join('')}
      <pre><code class="language-${esc((lang||'plaintext').toLowerCase())}">${esc(codeStr)}</code></pre>
    </div>`
  }

  const descHtml = renderDescriptionHTML(description)
  const allChatgpt = [...(primaryMeta.chatgptUrls || [])].filter(Boolean)
  const allYoutube = [...(primaryMeta.youtubeUrls || [])].filter(Boolean)

  const css = `
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 32px; color: #0f172a; max-width: 920px; background: #fff; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 6px; color: #0f172a; }
    .meta { font-size: 12px; color: #64748b; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .easy { background: #d1fae5; color: #065f46; } .medium { background: #fef9c3; color: #92400e; } .hard { background: #fee2e2; color: #991b1b; }
    .links-bar { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 10px 0 16px; }
    .links-bar a { color: #ea580c; text-decoration: none; font-size: 12px; font-weight: 600; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .tag { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #475569; }
    .desc-section { padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; page-break-inside: avoid; }
    .desc-section h2 { font-size: 14px; font-weight: 700; margin: 0 0 10px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .desc-content { font-size: 13px; line-height: 1.65; color: #334155; }
    .desc-content p { margin: 8px 0; }
    .desc-content pre { background: #f1f5f9; padding: 10px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #0f172a; border: 1px solid #cbd5e1; }
    .desc-content code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #ea580c; }
    .desc-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 10px 0; display: block; }
    .desc-content table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    .desc-content th, .desc-content td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; text-align: left; }
    .desc-content th { background: #f1f5f9; font-weight: 600; }
    .desc-content ul, .desc-content ol { padding-left: 20px; margin: 8px 0; }
    .code-block { margin: 18px 0; border: 1px solid #334155; border-radius: 8px; overflow: hidden; background: #1e1e2e; page-break-inside: avoid; }
    .code-label { font-weight: 700; font-size: 12px; padding: 8px 14px; background: #2d2d3f; color: #f97316; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .lang-badge { font-weight: 400; color: #94a3b8; font-size: 11px; background: #1e1e2e; padding: 2px 6px; border-radius: 4px; }
    .perf-badge { font-size: 11px; font-weight: 400; color: #cbd5e1; }
    .approach-note { font-size: 12px; color: #334155; padding: 12px 14px; background: #fffbeb; border-bottom: 1px solid #fde68a; }
    .link-item { font-size: 12px; padding: 6px 14px; background: #252538; border-bottom: 1px solid #334155; }
    .link-item a { color: #34d399; text-decoration: none; font-weight: 500; }
    pre { background: #1e1e2e; padding: 14px; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; margin: 0; color: #f8fafc; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace; }
    code { font-family: inherit; }
    .callout { background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: #92400e; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    @media print { body { margin: 12px; } .code-block, .desc-section { page-break-inside: avoid; } }
  `

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${lcNum ? lcNum + ' — ' : ''}${esc(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
<style>${css}</style></head>
<body>
<h1>${lcNum ? `<span style="color:#64748b;font-size:16px">${esc(lcNum)}</span> ` : ''}${esc(title)}</h1>
<div class="meta">
  ${difficulty ? `<span class="badge ${difficulty.toLowerCase()}">${esc(difficulty)}</span>` : ''}
  <span>${esc(language)}</span>
  ${primaryMeta.runtime ? `<span>⚡ ${esc(primaryMeta.runtime)}</span>` : ''}
  ${primaryMeta.memory  ? `<span>📦 ${esc(primaryMeta.memory)}</span>`  : ''}
  ${submission.submission_time || submission.created_at ? `<span>📅 ${format(new Date(submission.submission_time || submission.created_at), 'MMM d, yyyy')}</span>` : ''}
</div>
${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${esc(typeof t === 'string' ? t : t.name)}</span>`).join('')}</div>` : ''}
${(leetcodeUrl || allChatgpt.length || allYoutube.length) ? `
<div class="links-bar">
  ${leetcodeUrl ? `<a href="${esc(leetcodeUrl)}">\ud83d\udd17 LeetCode Problem</a>` : ''}
  ${allChatgpt.map((u,i) => `<a href="${esc(u)}">💬 ChatGPT${allChatgpt.length>1?` ${i+1}`:''}</a>`).join('')}
  ${allYoutube.map((u,i) => `<a href="${esc(u)}">▶ YouTube${allYoutube.length>1?` ${i+1}`:''}</a>`).join('')}
</div>` : ''}
${descHtml}
${codeBlock('Primary Solution', language, submission.code || '', primaryMeta)}
${alternates.map((a, i) => {
  const m = altMetas[a.id] || buildAltMeta(a)
  return codeBlock(a.label || `Alternate Approach ${i+1}`, a.language || language, a.code || '', m)
}).join('')}
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>
<script>hljs.highlightAll();<\/script>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) { toast.error('Allow popups to download PDF'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 800)
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
            <button onClick={() => generatePDF(submission, primaryMeta, altMetas)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/40 text-xs font-medium transition" title="Print / Save as PDF">
              <FileDown className="w-3.5 h-3.5" /><span className="hidden sm:inline">PDF</span>
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
