/**
 * StatsGrid.jsx
 * --------------
 * Overview stat cards showing:
 *  - Total Solved (with progress ring)
 *  - Easy / Medium / Hard counts
 *  - Progress bars relative to total
 *  - Loading skeletons
 *
 * Props:
 *  - stats   : { total, easy, medium, hard, totalAvailable? }
 *  - loading : boolean
 */

import { CheckCircle2, Zap, Flame, Skull } from 'lucide-react'

/* ─── Skeleton shimmer ──────────────────────────────────────────────────────── */
function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />
  )
}

/* ─── Circular progress ring ────────────────────────────────────────────────── */
function RingProgress({ value = 0, max = 100, color = '#FFA116', size = 56 }) {
  const radius      = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const pct         = max > 0 ? Math.min(value / max, 1) : 0
  const dashOffset  = circumference * (1 - pct)

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="5"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

/* ─── Progress bar ──────────────────────────────────────────────────────────── */
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mt-2">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

/* ─── Single stat card ──────────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  total,
  color,
  bgColor,
  borderColor,
  icon: Icon,
  ringColor,
  showRing = false,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="bg-[#111111] border border-white/5 rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-12 h-5 rounded" />
        </div>
        <Skeleton className="w-16 h-8 rounded" />
        <Skeleton className="w-24 h-3 rounded" />
        <Skeleton className="w-full h-1 rounded-full" />
      </div>
    )
  }

  return (
    <div
      className={`
        group relative bg-[#111111] border rounded-xl p-5 flex flex-col gap-1
        transition-all duration-300
        hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]
        ${borderColor}
      `}
    >
      {/* Icon + ring row */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            inline-flex items-center justify-center w-9 h-9 rounded-lg
            ${bgColor}
          `}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </span>

        {showRing && (
          <div className="relative flex items-center justify-center">
            <RingProgress value={value} max={total} color={ringColor ?? color} size={48} />
            <span className="absolute text-[9px] font-bold" style={{ color }}>
              {total > 0 ? `${Math.round((value / total) * 100)}%` : '—'}
            </span>
          </div>
        )}
      </div>

      {/* Number */}
      <p className="text-3xl font-bold text-white tracking-tight leading-none mt-1">
        {value ?? 0}
        {total != null && (
          <span className="text-base text-gray-600 font-normal ml-1">/ {total}</span>
        )}
      </p>

      {/* Label */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">{label}</p>

      {/* Progress bar */}
      {total > 0 && (
        <ProgressBar value={value} max={total} color={color} />
      )}

      {/* Gradient highlight on hover */}
      <div
        className="
          absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl opacity-0
          group-hover:opacity-100 transition-opacity duration-300
        "
        style={{ background: `linear-gradient(to right, transparent, ${color}80, transparent)` }}
      />
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function StatsGrid({ stats = {}, loading = false }) {
  const {
    total  = 0,
    easy   = 0,
    medium = 0,
    hard   = 0,
    totalAvailable = null, 
  } = stats

  const cards = [
    {
      label:       'Total Solved',
      value:       total,
      total:       totalAvailable,
      color:       '#FFA116',
      bgColor:     'bg-orange-500/10',
      borderColor: 'border-orange-500/10 hover:border-orange-500/20',
      ringColor:   '#FFA116',
      icon:        CheckCircle2,
      showRing:    !!totalAvailable,
    },
    {
      label:       'Easy',
      value:       easy,
      total:       total || undefined,
      color:       '#34D399',
      bgColor:     'bg-emerald-500/10',
      borderColor: 'border-emerald-500/10 hover:border-emerald-500/20',
      icon:        Zap,
    },
    {
      label:       'Medium',
      value:       medium,
      total:       total || undefined,
      color:       '#FBBF24',
      bgColor:     'bg-yellow-500/10',
      borderColor: 'border-yellow-500/10 hover:border-yellow-500/20',
      icon:        Flame,
    },
    {
      label:       'Hard',
      value:       hard,
      total:       total || undefined,
      color:       '#F87171',
      bgColor:     'bg-red-500/10',
      borderColor: 'border-red-500/10 hover:border-red-500/20',
      icon:        Skull,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  )
}
