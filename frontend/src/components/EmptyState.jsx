/**
 * EmptyState.jsx
 * ---------------
 * Centered empty state shown when:
 *  - No submissions exist yet (default)
 *  - No submissions match current filters (filtered=true)
 *
 * Props:
 *  - filtered : boolean – show "no filter matches" copy instead
 */

import { Code2, ArrowRight, SlidersHorizontal, ExternalLink } from 'lucide-react'

/* ─── Floating animated background orbs ────────────────────────────────────── */
function BackgroundOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Soft orange glow */}
      <div
        className="absolute rounded-full opacity-[0.04] blur-3xl"
        style={{
          width: 400,
          height: 400,
          background: '#FFA116',
          top:  '10%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
      {/* Subtle blue accent */}
      <div
        className="absolute rounded-full opacity-[0.03] blur-3xl"
        style={{
          width: 300,
          height: 300,
          background: '#3B82F6',
          bottom: '10%',
          right:  '20%',
        }}
      />
    </div>
  )
}

/* ─── Animated icon container ───────────────────────────────────────────────── */
function IconContainer({ filtered }) {
  return (
    <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-6">
      {/* Pulsing ring */}
      <div
        className="absolute inset-0 rounded-full border border-[#FFA116]/20 animate-ping"
        style={{ animationDuration: '3s' }}
      />
      {/* Static ring */}
      <div className="absolute inset-0 rounded-full border border-[#FFA116]/10" />
      {/* Icon bg */}
      <div
        className="
          relative flex items-center justify-center
          w-20 h-20 rounded-full
          bg-gradient-to-br from-[#FFA116]/10 to-[#FFA116]/5
          border border-[#FFA116]/20
        "
      >
        {filtered
          ? <SlidersHorizontal className="w-9 h-9 text-[#FFA116]/70" />
          : <Code2            className="w-9 h-9 text-[#FFA116]/70" />
        }
      </div>
    </div>
  )
}

/* ─── Step item ─────────────────────────────────────────────────────────────── */
function Step({ number, text }) {
  return (
    <li className="flex items-start gap-3">
      <span className="
        flex-shrink-0 inline-flex items-center justify-center
        w-6 h-6 rounded-full text-[11px] font-bold
        bg-[#FFA116]/10 text-[#FFA116] border border-[#FFA116]/20
        mt-0.5
      ">
        {number}
      </span>
      <span className="text-sm text-gray-400 leading-relaxed">{text}</span>
    </li>
  )
}

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function EmptyState({ filtered = false }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-24 px-6 text-center min-h-[60vh]">
      <BackgroundOrbs />

      {/* Icon */}
      <IconContainer filtered={filtered} />

      {filtered ? (
        /* ── Filter-empty variant ─────────────────────────────────────────── */
        <>
          <h2 className="text-xl font-semibold text-white mb-2">
            No problems match your filters
          </h2>
          <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">
            Try adjusting your search query, difficulty level, or clearing some filters to see more results.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/problems"
              className="
                inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                bg-white/5 border border-white/10 text-gray-300
                hover:bg-white/10 hover:border-white/20 hover:text-white
                transition-all duration-200
              "
            >
              <SlidersHorizontal className="w-4 h-4" />
              Clear filters
            </a>
          </div>
        </>
      ) : (
        /* ── First-time / no submissions variant ──────────────────────────── */
        <>
          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
            No submissions yet
          </h2>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed mb-8">
            LC&nbsp;Sync automatically captures your accepted LeetCode solutions.
            Install the browser extension, solve a problem, and your solution will appear here instantly.
          </p>

          {/* CTA */}
          <a
            href="https://leetcode.com/problemset/"
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
              bg-[#FFA116] text-black
              hover:bg-[#e8920f] active:bg-[#d4850d]
              transition-all duration-200 shadow-lg shadow-orange-500/20
              hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]
              mb-10
            "
          >
            Solve your first problem on LeetCode
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* How-to steps */}
          <div className="w-full max-w-sm text-left bg-[#111111] border border-white/5 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              How it works
            </p>
            <ol className="flex flex-col gap-3">
              <Step number="1" text="Install the LC Sync browser extension from the Chrome Web Store." />
              <Step number="2" text='Open any LeetCode problem and click "Submit".' />
              <Step number="3" text="Your accepted solution syncs here automatically—no copy-paste needed." />
            </ol>
          </div>

          {/* Subtle link row */}
          <div className="mt-6 flex items-center gap-4 text-xs text-gray-600">
            <a
              href="https://leetcode.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition flex items-center gap-1"
            >
              leetcode.com <ArrowRight className="w-3 h-3" />
            </a>
            <span className="w-px h-3 bg-white/10" />
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition flex items-center gap-1"
            >
              View on GitHub <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
