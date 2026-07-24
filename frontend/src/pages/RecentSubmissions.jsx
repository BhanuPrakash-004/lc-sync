/**
 * RecentSubmissions.jsx
 * ----------------------
 * Full-page view of all submissions, ordered newest first, with:
 *  - Paginated table (20 per page)
 *  - Sequential row numbering
 *  - Difficulty badge, language, relative time
 *  - Always-visible delete button (red trash icon)
 *  - Click row → /problems/:id
 *  - Mobile card fallback
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Clock, ChevronLeft, ChevronRight, ClipboardList, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchSubmissions, deleteSubmission } from '../lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PER_PAGE = 20

const DIFF_STYLES = {
  Easy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  Hard:   'bg-red-500/15 text-red-400 border-red-500/25',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DiffBadge({ difficulty }) {
  const cls = DIFF_STYLES[difficulty]
  if (!cls) return <span className="text-xs text-zinc-500">{difficulty || '—'}</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {difficulty}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination controls
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null

  // Show at most 5 page buttons around current
  const range = []
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, page + 2)
  for (let p = start; p <= end; p++) range.push(p)

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {/* Prev */}
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onPage(1)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition">1</button>
          {start > 2 && <span className="text-zinc-600 text-xs px-1">…</span>}
        </>
      )}

      {range.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            p === page
              ? 'bg-orange-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-zinc-600 text-xs px-1">…</span>}
          <button onClick={() => onPage(totalPages)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
            {totalPages}
          </button>
        </>
      )}

      {/* Next */}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loaders
// ─────────────────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-zinc-800/50">
      <td className="px-4 py-3"><div className="h-3 bg-zinc-800 rounded w-6" /></td>
      <td className="px-3 py-3"><div className="h-3 bg-zinc-800 rounded w-10" /></td>
      <td className="px-3 py-3"><div className="h-3 bg-zinc-800 rounded w-48" /></td>
      <td className="px-3 py-3 hidden sm:table-cell"><div className="h-5 bg-zinc-800 rounded-full w-16" /></td>
      <td className="px-3 py-3 hidden md:table-cell"><div className="h-3 bg-zinc-800 rounded w-14" /></td>
      <td className="px-3 py-3 hidden md:table-cell"><div className="h-3 bg-zinc-800 rounded w-14" /></td>
      <td className="px-4 py-3"><div className="h-7 bg-zinc-800 rounded-lg w-7" /></td>
    </tr>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 space-y-2">
      <div className="h-4 bg-zinc-800 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-5 bg-zinc-800 rounded-full w-16" />
        <div className="h-5 bg-zinc-800 rounded w-14" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm delete dialog
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ submission, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Delete Submission?</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Remove <span className="text-zinc-200 font-medium">"{submission.problem_title}"</span> from your history? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function RecentSubmissions() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage]       = useState(1)
  const [toDelete, setToDelete] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recentAll', page],
    queryFn: () => fetchSubmissions({ page, perPage: PER_PAGE, sortBy: 'created_at', sortOrder: 'desc' }),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  })

  const submissions  = data?.data ?? []
  const total        = data?.total ?? 0
  const totalPages   = Math.ceil(total / PER_PAGE)
  // Global sequential index: page 1 row 0 → index 1, etc.
  const startIndex   = (page - 1) * PER_PAGE + 1

  const deleteMut = useMutation({
    mutationFn: (id) => deleteSubmission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentAll'] })
      queryClient.invalidateQueries({ queryKey: ['recent'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Submission deleted.')
      setToDelete(null)
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  })

  const handleRowClick = (id) => navigate(`/problems/${id}`)
  const handleDelete   = (e, sub) => { e.stopPropagation(); setToDelete(sub) }

  return (
    <>
      {toDelete && (
        <ConfirmDialog
          submission={toDelete}
          onConfirm={() => deleteMut.mutate(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-5 h-5 text-orange-400" />
                <h1 className="text-2xl font-bold text-white tracking-tight">Recent Submissions</h1>
              </div>
              <p className="text-sm text-zinc-400">
                {!isLoading && total > 0
                  ? `${total} submission${total !== 1 ? 's' : ''} — page ${page} of ${totalPages}`
                  : 'All your synced submissions, newest first.'}
              </p>
            </div>
          </div>

          {/* Error */}
          {isError && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Failed to load submissions. Please refresh.
            </div>
          )}

          {/* ── Desktop Table ──────────────────────────────────────────────── */}
          <div className="hidden md:block rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-900/80 border-b border-zinc-800/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 w-12">#</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 w-16">LC</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500">Title</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 w-28">Difficulty</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 w-24">Language</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 w-28">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Time</div>
                  </th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: PER_PAGE }).map((_, i) => <RowSkeleton key={i} />)
                  : submissions.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-zinc-500 text-sm">
                        No submissions found.
                      </td>
                    </tr>
                  )
                  : submissions.map((sub, i) => (
                    <tr
                      key={sub.id}
                      onClick={() => handleRowClick(sub.id)}
                      className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    >
                      {/* Sequential # */}
                      <td className="px-4 py-3 text-xs text-zinc-600 font-mono">
                        {startIndex + i}
                      </td>
                      {/* LC problem_id */}
                      <td className="px-3 py-3 text-xs text-zinc-500 font-mono">
                        {sub.problem_id ? `#${sub.problem_id}` : '—'}
                      </td>
                      {/* Title */}
                      <td className="px-3 py-3">
                        <span className="text-sm font-medium text-zinc-100 hover:text-white transition-colors">
                          {sub.problem_title}
                        </span>
                      </td>
                      {/* Difficulty */}
                      <td className="px-3 py-3">
                        <DiffBadge difficulty={sub.difficulty} />
                      </td>
                      {/* Language */}
                      <td className="px-3 py-3 text-xs text-orange-400">{sub.language || '—'}</td>
                      {/* Time ago */}
                      <td className="px-3 py-3 text-xs text-zinc-500">{timeAgo(sub.created_at)}</td>
                      {/* Delete */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDelete(e, sub)}
                          disabled={deleteMut.isPending}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                          title="Delete submission"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ───────────────────────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
              : submissions.length === 0
              ? (
                <div className="text-center py-16 text-zinc-500 text-sm">No submissions found.</div>
              )
              : submissions.map((sub, i) => (
                <div
                  key={sub.id}
                  onClick={() => handleRowClick(sub.id)}
                  className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 cursor-pointer hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">
                          {startIndex + i}.
                        </span>
                        {sub.problem_id && (
                          <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
                            LC#{sub.problem_id}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-zinc-100 truncate">{sub.problem_title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <DiffBadge difficulty={sub.difficulty} />
                        {sub.language && (
                          <span className="text-xs text-orange-400">{sub.language}</span>
                        )}
                        <span className="text-xs text-zinc-500">{timeAgo(sub.created_at)}</span>
                      </div>
                    </div>
                    {/* Delete — always visible */}
                    <button
                      onClick={(e) => handleDelete(e, sub)}
                      disabled={deleteMut.isPending}
                      className="flex-shrink-0 p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                      title="Delete submission"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
          )}

        </div>
      </div>
    </>
  )
}
