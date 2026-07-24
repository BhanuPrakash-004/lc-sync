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

import { useState, useCallback, useEffect } from 'react'
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
  ExternalLink,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const DIFF_COLOR = { Easy: '#10b981', Medium: '#f59e0b', Hard: '#ef4444' }
const DIFF_BG    = { Easy: '#d1fae5', Medium: '#fef9c3', Hard: '#fee2e2' }
const DIFF_TEXT  = { Easy: '#065f46', Medium: '#92400e', Hard: '#991b1b' }

// ---------------------------------------------------------------------------
// Supabase fetchers
// ---------------------------------------------------------------------------
async function fetchTopicsWithSubtopics() {
  const [topicsRes, subtopicsRes] = await Promise.all([
    supabase.from('topics').select('name,sort_order').order('sort_order', { ascending: true }),
    supabase.from('subtopics').select('topic_name,name,sort_order').order('sort_order', { ascending: true }),
  ])
  if (topicsRes.error) throw topicsRes.error

  const subMap = {}
  ;(subtopicsRes.data || []).forEach((s) => {
    if (!subMap[s.topic_name]) subMap[s.topic_name] = []
    subMap[s.topic_name].push(s.name)
  })

  return (topicsRes.data || []).map((t) => ({
    name: t.name,
    sort_order: t.sort_order,
    subtopics: subMap[t.name] || [],
  }))
}

async function fetchAllProblems() {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id,problem_id,problem_title,difficulty,language,user_topic,subtopic,tags,runtime,memory,url,created_at'
    )
    .eq('is_accepted', true)
    .order('problem_id', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchFullSubmissions(ids) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .in('id', ids)
    .order('problem_id', { ascending: true })
  if (error) throw error
  return data || []
}

// ---------------------------------------------------------------------------
// PDF HTML generator
// ---------------------------------------------------------------------------
function renderPDFDescription(description) {
  if (!description || !description.trim()) return ''
  const isHtml = /<[a-z][\s\S]*>/i.test(description) || description.trimStart().startsWith('<')
  if (isHtml) {
    const processed = description.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (!/referrerpolicy/i.test(attrs)) {
        return `<img${attrs} referrerpolicy="no-referrer">`
      }
      return match
    })
    return `<div class="description"><strong>📝 Description</strong><div class="desc-content">${processed}</div></div>`
  }
  return `<div class="description"><strong>📝 Description</strong><div class="desc-content"><pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.6;margin:0;">${esc(description)}</pre></div></div>`
}

function renderPDFBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return ''
  return blocks
    .map((b) => {
      if (!b) return ''
      const content = b.content || ''
      if (b.type === 'h1') return `<h3 style="font-size:15px;font-weight:700;margin:12px 0 4px;color:#111;">${esc(content)}</h3>`
      if (b.type === 'h2') return `<h4 style="font-size:14px;font-weight:700;margin:10px 0 4px;color:#111;">${esc(content)}</h4>`
      if (b.type === 'h3') return `<h5 style="font-size:13px;font-weight:600;margin:8px 0 4px;color:#374151;">${esc(content)}</h5>`
      if (b.type === 'text') return content ? `<p style="margin:4px 0;line-height:1.6;color:#374151;white-space:pre-wrap;">${esc(content)}</p>` : ''
      if (b.type === 'bullet') return `<div style="margin:3px 0;padding-left:12px;color:#374151;">• ${esc(content)}</div>`
      if (b.type === 'todo')
        return `<div style="margin:3px 0;color:#374151;">${b.checked ? '☑' : '☐'} <span style="${b.checked ? 'text-decoration:line-through;color:#9ca3af;' : ''}">${esc(content)}</span></div>`
      if (b.type === 'code')
        return `<div class="code-block" style="margin:8px 0;"><div class="code-label">${esc((b.language || 'code').toUpperCase())}</div><pre><code class="language-${esc((b.language||'plaintext').toLowerCase())}">${esc(content)}</code></pre></div>`
      if (b.type === 'image') {
        if (!content) return ''
        return `
          <div style="margin:12px 0;text-align:center;page-break-inside:avoid;">
            <img src="${esc(content)}" alt="${esc(b.caption || 'Image')}" referrerpolicy="no-referrer" crossorigin="anonymous" style="max-width:100%;max-height:380px;object-fit:contain;border-radius:6px;border:1px solid #374151;box-shadow:0 1px 3px rgba(0,0,0,0.2);display:inline-block;" />
            ${b.caption ? `<div style="font-size:11px;color:#9ca3af;font-style:italic;margin-top:3px;">${esc(b.caption)}</div>` : ''}
          </div>`
      }
      if (b.type === 'link') {
        return `<div style="margin:4px 0;"><a href="${esc(b.url || '#')}" style="color:#c2410c;text-decoration:none;font-weight:600;font-size:11px;">🔗 ${esc(b.title || b.url)}</a></div>`
      }
      if (b.type === 'chatgpt') {
        return `<div style="margin:4px 0;"><a href="${esc(b.url || '#')}" style="color:#059669;text-decoration:none;font-weight:600;font-size:11px;">💬 ${esc(b.title || 'ChatGPT Discussion')}</a></div>`
      }
      if (b.type === 'callout')
        return `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:6px 10px;margin:8px 0;border-radius:4px;color:#92400e;font-size:12px;">${esc(b.icon || '💡')} ${esc(content)}</div>`
      if (b.type === 'divider') return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />'
      return content ? `<p style="margin:4px 0;color:#374151;">${esc(content)}</p>` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function buildPDFHTML(submissions) {
  const codeBlock = (label, code, lang) => `
    <div class="code-block">
      <div class="code-label">${esc(label)} <span class="lang">${esc(lang)}</span></div>
      <pre><code class="language-${esc((lang||'plaintext').toLowerCase())}">${esc(code || '')}</code></pre>
    </div>`

  const linkRow = (icon, text, url) =>
    url
      ? `<a href="${esc(url)}" class="link-pill">
           <span class="link-icon">${icon}</span>
           ${esc(text)}
         </a>`
      : ''

  const problemHtml = submissions.map((s, i) => {
    const num = s.problem_id > 0 ? `LC #${s.problem_id} · ` : `${i + 1}. `
    const alts = Array.isArray(s.alternate_codes) ? s.alternate_codes : []
    const chatUrls  = Array.isArray(s.chatgpt_urls)  ? s.chatgpt_urls  : (s.chatgpt_url  ? [s.chatgpt_url]  : [])
    const ytUrls    = Array.isArray(s.youtube_urls)  ? s.youtube_urls  : (s.youtube_url  ? [s.youtube_url]  : [])
    const topic     = s.user_topic || (s.tags && s.tags[0]) || ''
    const subtopic  = s.subtopic || ''

    const descHtml = renderPDFDescription(s.description)

    const primaryBlocks = renderPDFBlocks(s.page_blocks)
    const primaryNotes  = s.notes ? `<p style="white-space:pre-wrap;margin:4px 0;">${esc(s.notes)}</p>` : ''
    const notesHtml     = (primaryBlocks || primaryNotes)
      ? `<div class="notes"><strong>🗒 Notes &amp; Highlights</strong>${primaryNotes}${primaryBlocks}</div>`
      : ''

    const altNotesHtml = alts
      .map((a, j) => {
        const aBlocks = renderPDFBlocks(a.page_blocks)
        const aNotes  = a.notes ? `<p style="white-space:pre-wrap;margin:4px 0;">${esc(a.notes)}</p>` : ''
        if (!aBlocks && !aNotes) return ''
        return `<div class="alt-notes"><strong>💡 ${esc(a.label || `Approach ${j + 1}`)} Notes</strong>${aNotes}${aBlocks}</div>`
      })
      .filter(Boolean)
      .join('')

    const lcLinkHtml = s.url
      ? `<a href="${esc(s.url)}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:600;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;text-decoration:none;flex-shrink:0;" title="Open on LeetCode">🔗 LeetCode</a>`
      : ''

    const linksHtml = (() => {
      const pills = [
        ...chatUrls.map((u, k) => linkRow('🤖', `ChatGPT${chatUrls.length > 1 ? ` ${k + 1}` : ''}`, u)),
        ...ytUrls.map((u, k)   => linkRow('▶',  `YouTube${ytUrls.length > 1 ? ` ${k + 1}` : ''}`, u)),
        ...alts.map((a, k) => a.chatgpt_url ? linkRow('🤖', `ChatGPT (${esc(a.label || `Alt ${k + 1}`)})`, a.chatgpt_url) : ''),
        ...alts.map((a, k) => a.youtube_url ? linkRow('▶', `YouTube (${esc(a.label || `Alt ${k + 1}`)})`, a.youtube_url) : ''),
      ].filter(Boolean)
      return pills.length
        ? `<div class="links-row">${pills.join('')}</div>`
        : ''
    })()

    const metaRow = [
      s.language && `<span class="meta-chip code">${esc(s.language)}</span>`,
      s.runtime  && `<span class="meta-chip perf">⚡ ${esc(s.runtime)}</span>`,
      s.memory   && `<span class="meta-chip perf">📦 ${esc(s.memory)}</span>`,
      topic      && `<span class="meta-chip topic">${esc(topic)}${subtopic ? ' › ' + subtopic : ''}</span>`,
    ].filter(Boolean).join('')

    return `
      <div class="problem">
        <div class="problem-header">
          <h2>${esc(num)}${esc(s.problem_title)}</h2>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${lcLinkHtml}
            <span class="diff-badge" style="background:${DIFF_BG[s.difficulty]||'#f3f4f6'};color:${DIFF_TEXT[s.difficulty]||'#374151'}">${esc(s.difficulty||'')}</span>
          </div>
        </div>
        <div class="meta-row">${metaRow}</div>
        ${descHtml}
        ${codeBlock('Primary Solution', s.code || '', s.language || '')}
        ${alts.map((a, j) => codeBlock(a.label || `Alternate Approach ${j + 1}`, a.code || '', a.language || s.language || '')).join('')}
        ${notesHtml}
        ${altNotesHtml}
        ${linksHtml}
      </div>`
  }).join('<hr/>')

  const css = `
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 28px 32px; color: #111; background: #fff; font-size: 13px; }
    h1  { font-size: 22px; font-weight: 800; margin: 0 0 2px; color: #1a1a1a; }
    .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 36px; }
    .toc { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 36px; page-break-inside: avoid; }
    .toc h3 { margin: 0 0 10px; font-size: 13px; color: #374151; }
    .toc ol  { margin: 0; padding-left: 18px; columns: 2; column-gap: 24px; }
    .toc li  { font-size: 11px; color: #4b5563; margin-bottom: 3px; break-inside: avoid; }
    .problem { margin-bottom: 36px; page-break-inside: avoid; }
    .problem-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    h2 { font-size: 15px; font-weight: 700; margin: 0; color: #111; flex: 1; }
    .diff-badge { display: inline-block; padding: 2px 9px; border-radius: 4px; font-size: 10px; font-weight: 700; flex-shrink: 0; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
    .meta-chip { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    .meta-chip.code  { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .meta-chip.perf  { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
    .meta-chip.topic { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .description { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .description strong { color: #1e293b; font-size: 12px; display: block; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .desc-content { color: #374151; line-height: 1.6; font-size: 12.5px; }
    .desc-content p { margin: 6px 0; }
    .desc-content pre { background: #f1f5f9; padding: 10px 12px; border-radius: 6px; font-family: monospace; font-size: 11.5px; white-space: pre-wrap; overflow-x: auto; color: #0f172a; border: 1px solid #cbd5e1; }
    .desc-content code { background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 11.5px; color: #ea580c; }
    .desc-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0; display: block; }
    .desc-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    .desc-content th, .desc-content td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11.5px; text-align: left; }
    .desc-content th { background: #f1f5f9; font-weight: 600; }
    .desc-content ul, .desc-content ol { padding-left: 18px; margin: 6px 0; }
    .notes { background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 12px 14px; margin-top: 12px; }
    .notes strong { color: #92400e; font-size: 12px; display: block; margin-bottom: 6px; }
    .alt-notes { background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 6px; padding: 12px 14px; margin-top: 10px; }
    .alt-notes strong { color: #1e40af; font-size: 12px; display: block; margin-bottom: 6px; }
    .code-block { margin: 12px 0; border: 1px solid #374151; border-radius: 6px; overflow: hidden; background: #1e1e2e; }
    .code-label { font-weight: 700; font-size: 11px; background: #2d2d3f; color: #f97316; padding: 6px 12px; border-bottom: 1px solid #374151; display: flex; align-items: center; justify-content: space-between; }
    .lang { font-weight: 400; color: #9ca3af; font-size: 10px; }
    pre  { background: #1e1e2e; padding: 12px 14px; font-size: 11px; line-height: 1.55; white-space: pre-wrap; word-break: break-all; margin: 0; color: #f8fafc; font-family: 'Cascadia Code','Fira Code','Consolas',monospace; }
    code { font-family: inherit; }
    .links-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .link-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; text-decoration: none; }
    .link-pill:hover { background: #e2e8f0; }
    .link-icon { font-size: 11px; }
    hr  { border: none; border-top: 1px solid #e5e7eb; margin: 32px 0; }
    @page { margin: 20mm 18mm; }
    @media print { .problem { page-break-inside: avoid; } pre { max-height: none !important; } }
  `

  const tocItems = submissions
    .map((s, i) => `<li>${i + 1}. ${esc(s.problem_title)}${s.problem_id > 0 ? ` (LC #${s.problem_id})` : ''}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LC Sync — PDF Export</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
  <style>${css}</style>
</head>
<body>
  <h1>LC Sync — Solutions PDF</h1>
  <div class="subtitle">
    Generated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
    &nbsp;·&nbsp; ${submissions.length} problem${submissions.length !== 1 ? 's' : ''}
  </div>

  ${submissions.length > 3 ? `<div class="toc"><h3>📋 Table of Contents</h3><ol>${tocItems}</ol></div>` : ''}

  ${problemHtml}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>
  <script>document.addEventListener('DOMContentLoaded', function() { hljs.highlightAll(); });<\/script>
</body>
</html>`
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
        {(sub.user_topic || sub.subtopic) && (
          <p className="text-[10px] text-zinc-600 mt-0.5 truncate">
            {sub.user_topic}{sub.subtopic ? ` › ${sub.subtopic}` : ''}
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
  const [selectedSubtopics, setSelectedSubtopics] = useState([]) // "TopicName|||SubtopicName"
  const [selectedIds, setSelectedIds]         = useState(new Set())
  const [generating, setGenerating]           = useState(false)
  const [progress, setProgress]               = useState('')
  const [searchQ, setSearchQ]                 = useState('')
  const [expandedTopics, setExpandedTopics]   = useState({})

  // Data queries
  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['pdf-topics'],
    queryFn: fetchTopicsWithSubtopics,
    staleTime: 1000 * 60 * 5,
  })

  const { data: allProblems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ['pdf-problems'],
    queryFn: fetchAllProblems,
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = topicsLoading || problemsLoading

  // Derived: problems grouped
  const problemsByTopic = {}
  allProblems.forEach((p) => {
    const t = p.user_topic || (p.tags && p.tags[0]) || 'Uncategorized'
    if (!problemsByTopic[t]) problemsByTopic[t] = {}
    const sub = p.subtopic || 'General'
    if (!problemsByTopic[t][sub]) problemsByTopic[t][sub] = []
    problemsByTopic[t][sub].push(p)
  })

  // Filtered problems for 'selected' mode
  const filteredProblems = allProblems.filter((p) => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (
      p.problem_title.toLowerCase().includes(q) ||
      String(p.problem_id).includes(q) ||
      (p.user_topic || '').toLowerCase().includes(q) ||
      (p.subtopic || '').toLowerCase().includes(q)
    )
  })

  // Preview count
  const previewCount = (() => {
    if (mode === 'all') return allProblems.length
    if (mode === 'topic') {
      return allProblems.filter((p) => {
        const t = p.user_topic || (p.tags && p.tags[0]) || 'Uncategorized'
        return selectedTopics.includes(t)
      }).length
    }
    if (mode === 'subtopic') {
      return allProblems.filter((p) => {
        const t = p.user_topic || (p.tags && p.tags[0]) || 'Uncategorized'
        const s = p.subtopic || 'General'
        return selectedSubtopics.includes(`${t}|||${s}`)
      }).length
    }
    if (mode === 'selected') return selectedIds.size
    return 0
  })()

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
  const handleGenerate = useCallback(async () => {
    if (!mode) { toast.error('Please select an export mode first.'); return }

    let targetIds = []

    if (mode === 'all') {
      targetIds = allProblems.map((p) => p.id)
    } else if (mode === 'topic') {
      if (selectedTopics.length === 0) { toast.error('Please select at least one topic.'); return }
      targetIds = allProblems
        .filter((p) => {
          const t = p.user_topic || (p.tags && p.tags[0]) || 'Uncategorized'
          return selectedTopics.includes(t)
        })
        .map((p) => p.id)
    } else if (mode === 'subtopic') {
      if (selectedSubtopics.length === 0) { toast.error('Please select at least one subtopic.'); return }
      targetIds = allProblems
        .filter((p) => {
          const t = p.user_topic || (p.tags && p.tags[0]) || 'Uncategorized'
          const s = p.subtopic || 'General'
          return selectedSubtopics.includes(`${t}|||${s}`)
        })
        .map((p) => p.id)
    } else if (mode === 'selected') {
      if (selectedIds.size === 0) { toast.error('Please select at least one problem.'); return }
      targetIds = Array.from(selectedIds)
    }

    if (targetIds.length === 0) {
      toast.error('No problems match your selection. Please add problems to the topics first.')
      return
    }

    setGenerating(true)
    try {
      setProgress(`Fetching ${targetIds.length} problem${targetIds.length !== 1 ? 's' : ''}…`)
      const CHUNK = 50
      let full = []
      for (let i = 0; i < targetIds.length; i += CHUNK) {
        const chunk = targetIds.slice(i, i + CHUNK)
        setProgress(`Loading ${Math.min(i + CHUNK, targetIds.length)} / ${targetIds.length}…`)
        const rows = await fetchFullSubmissions(chunk)
        full = [...full, ...rows]
      }

      // Sort by problem_id
      full.sort((a, b) => (a.problem_id || 0) - (b.problem_id || 0))

      setProgress('Building PDF…')
      const html = buildPDFHTML(full)

      const win = window.open('', '_blank')
      if (!win) { toast.error('Please allow pop-ups for this site.'); return }
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 800)
      toast.success(`PDF ready! ${full.length} problem${full.length !== 1 ? 's' : ''} loaded.`)
    } catch (err) {
      toast.error(`PDF generation failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }, [mode, allProblems, selectedTopics, selectedSubtopics, selectedIds])

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
              Generate a beautiful, print-ready PDF with code, notes, descriptions &amp; links.
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
                  {/* Topic selector */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {topics.map((t) => {
                      const cnt = (problemsByTopic[t.name] &&
                        Object.values(problemsByTopic[t.name]).flat().length) || 0
                      const isSelected = selectedTopics.includes(t.name)
                      return (
                        <div
                          key={t.name}
                          onClick={() => toggleTopic(t.name)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
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
                          <span className="text-[10px] text-zinc-600 ml-2 flex-shrink-0">{cnt}</span>
                        </div>
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
                    {topics.filter((t) => t.subtopics.length > 0).map((t) => {
                      const hasExpanded = expandedTopics[t.name]
                      const topicSubs = (problemsByTopic[t.name] && Object.keys(problemsByTopic[t.name])) || []
                      const allSubs = Array.from(new Set([...t.subtopics, ...topicSubs]))
                      const anySelected = allSubs.some((s) => selectedSubtopics.includes(`${t.name}|||${s}`))

                      return (
                        <div key={t.name}>
                          <button
                            onClick={() => toggleExpandTopic(t.name)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition text-left ${anySelected ? 'text-blue-300' : 'text-zinc-400'}`}
                          >
                            <span className="text-xs font-semibold uppercase tracking-wide">{t.name}</span>
                            {hasExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          {hasExpanded && (
                            <div className="ml-3 mt-1 space-y-1">
                              {allSubs.map((s) => {
                                const key = `${t.name}|||${s}`
                                const isSel = selectedSubtopics.includes(key)
                                const cnt = (problemsByTopic[t.name]?.[s] || []).length
                                return (
                                  <div
                                    key={key}
                                    onClick={() => toggleSubtopic(key)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                      isSel
                                        ? 'bg-blue-500/15 border border-blue-500/30'
                                        : 'hover:bg-zinc-800/60 border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`flex-shrink-0 ${isSel ? 'text-blue-400' : 'text-zinc-600'}`}>
                                        {isSel ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded border border-zinc-700" />}
                                      </div>
                                      <span className={`text-xs truncate ${isSel ? 'text-white font-medium' : 'text-zinc-300'}`}>{s}</span>
                                    </div>
                                    {cnt > 0 && <span className="text-[10px] text-zinc-600 ml-2 flex-shrink-0">{cnt}</span>}
                                  </div>
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
                  { icon: FileText,    label: 'Problem Description', color: 'text-emerald-400 bg-emerald-500/10' },
                  { icon: Code2,       label: 'Primary Solution Code', color: 'text-orange-400 bg-orange-500/10' },
                  { icon: Layers,      label: 'All Alternate Approaches', color: 'text-blue-400 bg-blue-500/10' },
                  { icon: StickyNote,  label: 'Notes (Main + Per-Approach)', color: 'text-yellow-400 bg-yellow-500/10' },
                  { icon: Link2,       label: 'LeetCode / ChatGPT / YouTube Links', color: 'text-violet-400 bg-violet-500/10' },
                  { icon: ListChecks,  label: 'Table of Contents', color: 'text-zinc-400 bg-zinc-700/50' },
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
                  <h2 className="text-base font-semibold text-white">Generate PDF</h2>
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
                    <span>Generate &amp; Print PDF</span>
                    {previewCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold">
                        {previewCount > 99 ? '99+' : previewCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

            {/* ── Tip ─────────────────────────────────────────────────────── */}
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
              <ExternalLink className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                A print dialog will open in a new tab. Use <strong className="text-zinc-400">Save as PDF</strong> in the destination dropdown, set margins to <strong className="text-zinc-400">Minimum</strong>, and enable <strong className="text-zinc-400">Background graphics</strong> for best results.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
