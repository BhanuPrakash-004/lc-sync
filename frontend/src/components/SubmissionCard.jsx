/**
 * SubmissionCard.jsx
 * -------------------
 * Displays a single LeetCode submission with:
 *  - Problem number, title (linked), difficulty badge, language badge
 *  - Tags (first 3 + overflow count)
 *  - Relative timestamp via date-fns
 *  - Code snippet preview (first 3 lines)
 *  - View and Delete (with confirmation) actions
 *  - Orange border glow on hover
 *
 * Props:
 *  - submission  : object – the submission data
 *  - onDelete    : (id: string) => void
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Eye, Clock, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/* ─── Difficulty badge ──────────────────────────────────────────────────────── */
const DIFFICULTY_STYLES = {
  Easy:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-yellow-500/10  text-yellow-400  border-yellow-500/20',
  Hard:   'bg-red-500/10     text-red-400     border-red-500/20',
}

function DifficultyBadge({ difficulty }) {
  const cls = DIFFICULTY_STYLES[difficulty] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${cls}`}>
      {difficulty}
    </span>
  )
}

/* ─── Language badge ────────────────────────────────────────────────────────── */
function LanguageBadge({ language }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
      {language}
    </span>
  )
}

/* ─── Tag chip ──────────────────────────────────────────────────────────────── */
function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/5 text-gray-400 border border-white/10">
      {tag}
    </span>
  )
}

/* ─── Code preview (first N lines) ─────────────────────────────────────────── */
function CodePreview({ code, maxLines = 3 }) {
  if (!code) return null
  const lines = code.split('\n').slice(0, maxLines)
  return (
    <div className="mt-3 rounded-md overflow-hidden border border-white/5 bg-[#0F0F0F]">
      <pre className="px-4 py-3 text-[11px] leading-5 font-mono text-gray-300 overflow-hidden">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            {/* Line number */}
            <span className="select-none text-gray-600 w-6 flex-shrink-0 text-right mr-3">{i + 1}</span>
            <span className="truncate">{line}</span>
          </div>
        ))}
        {/* Ellipsis hint */}
        {code.split('\n').length > maxLines && (
          <div className="flex mt-0.5">
            <span className="select-none text-gray-600 w-6 flex-shrink-0 text-right mr-3">…</span>
            <span className="text-gray-600 italic text-[10px]">
              {code.split('\n').length - maxLines} more line{code.split('\n').length - maxLines > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </pre>
    </div>
  )
}

/* ─── Delete confirmation dialog ────────────────────────────────────────────── */
function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-2">Delete submission?</h3>
        <p className="text-sm text-gray-400 mb-6">
          This action cannot be undone. The submission will be permanently removed.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function SubmissionCard({ submission, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false)

  if (!submission) return null

  const id = submission.id
  const problemNumber = submission.problem_id || submission.problem_number
  const title = submission.problem_title || submission.title || 'Untitled Problem'
  const difficulty = submission.difficulty || 'Medium'
  const language = submission.language || 'Python'
  const tags = submission.tags || []
  const code = submission.code || ''
  const submittedAt = submission.submission_time || submission.submitted_at || submission.created_at

  /* Relative time */
  const timeAgo = submittedAt
    ? formatDistanceToNow(new Date(submittedAt), { addSuffix: true })
    : null

  /* Show first 3 tags + overflow */
  const visibleTags  = tags.slice(0, 3)
  const overflowCount = tags.length - visibleTags.length

  const handleDelete = () => {
    setShowConfirm(false)
    onDelete?.(id)
  }

  return (
    <>
      {showConfirm && (
        <DeleteConfirmModal
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <article
        className="
          group relative flex flex-col
          bg-[#111111] border border-white/5 rounded-xl p-4
          transition-all duration-300 ease-in-out
          hover:border-[#FFA116]/30 hover:shadow-[0_0_20px_rgba(255,161,22,0.06)]
        "
      >
        {/* ── Top row ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {/* Problem number + title */}
            <Link
              to={`/problems/${id}`}
              className="group/link flex items-center gap-1.5 hover:text-[#FFA116] transition-colors"
            >
              {problemNumber && (
                <span className="text-xs font-mono text-gray-500 flex-shrink-0">
                  #{problemNumber}
                </span>
              )}
              <h2 className="text-sm font-semibold text-white truncate group-hover/link:text-[#FFA116] transition-colors">
                {title}
              </h2>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 group-hover/link:text-[#FFA116] transition-colors" />
            </Link>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5">
              <DifficultyBadge difficulty={difficulty} />
              <LanguageBadge   language={language}   />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View */}
            <Link
              to={`/problems/${id}`}
              className="
                flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg
                bg-white/5 border border-white/10 text-gray-300
                hover:bg-[#FFA116]/10 hover:border-[#FFA116]/30 hover:text-[#FFA116]
                transition-all duration-200
              "
              title="View submission"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View</span>
            </Link>

            {/* Delete */}
            <button
              onClick={() => setShowConfirm(true)}
              className="
                flex items-center justify-center p-1.5 rounded-lg
                text-gray-500 border border-transparent
                hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20
                transition-all duration-200
              "
              title="Delete submission"
              aria-label="Delete submission"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tags row ────────────────────────────────────────────────────── */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {visibleTags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
            {overflowCount > 0 && (
              <span className="text-[10px] text-gray-500 font-medium">
                +{overflowCount} more
              </span>
            )}
          </div>
        )}

        {/* ── Code snippet preview ─────────────────────────────────────────── */}
        {code && <CodePreview code={code} maxLines={3} />}

        {/* ── Timestamp ───────────────────────────────────────────────────── */}
        {timeAgo && (
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-gray-500">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{timeAgo}</span>
          </div>
        )}

        {/* ── Subtle corner accent visible on hover ───────────────────────── */}
        <span
          className="
            absolute top-0 right-0 w-16 h-0.5 rounded-tr-xl
            bg-gradient-to-l from-[#FFA116]/0 to-transparent
            opacity-0 group-hover:opacity-100 group-hover:from-[#FFA116]/60
            transition-all duration-300
          "
        />
      </article>
    </>
  )
}
