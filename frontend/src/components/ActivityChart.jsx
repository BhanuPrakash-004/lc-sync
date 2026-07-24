import { useState, useMemo } from 'react'

// Color scale from dark gray to vivid orange based on submission count
function cellColor(count) {
  if (!count || count === 0) return { bg: '#1C1C1C', label: 'none' }
  if (count === 1)           return { bg: '#7C3400', label: '1' }
  if (count === 2)           return { bg: '#B34E00', label: '2' }
  if (count === 3)           return { bg: '#E06900', label: '3' }
  return                            { bg: '#FFA116', label: '4+' }
}

// Build 12-week grid (7 days x 12 cols) aligned to current week
function buildGrid(activityData = {}) {
  const WEEKS = 12
  const DAYS  = 7

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(today)
  start.setDate(start.getDate() - (WEEKS * DAYS - 1))

  const totalDays = WEEKS * DAYS
  const dates = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })

  const weeks = []
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(dates.slice(w * DAYS, w * DAYS + DAYS))
  }

  return { weeks, today }
}

// Format date as YYYY-MM-DD key
function toKey(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Extract month labels for column header alignment
function getMonthLabels(weeks) {
  const labels = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstDay = week[0]
    const m = firstDay.getMonth()
    if (m !== lastMonth) {
      labels.push({
        month: firstDay.toLocaleString('default', { month: 'short' }),
        col:   wi,
      })
      lastMonth = m
    }
  })
  return labels
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_DAY  = { Mon: 'M', Wed: 'W', Fri: 'F' }

function Tooltip({ date, count, x, y }) {
  return (
    <div
      className="
        fixed z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium
        bg-gray-900 border border-white/10 shadow-xl text-gray-100
        pointer-events-none whitespace-nowrap
      "
      style={{ left: x + 12, top: y - 8 }}
    >
      <span className="text-[#FFA116] font-bold">{count}</span>
      &nbsp;submission{count !== 1 ? 's' : ''} on&nbsp;
      {new Date(date).toLocaleDateString('default', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })}
    </div>
  )
}

function Cell({ date, count, onMouseEnter, onMouseLeave }) {
  const { bg } = cellColor(count)
  const isToday = toKey(new Date()) === toKey(date)

  return (
    <div
      className="
        w-3 h-3 rounded-sm cursor-default transition-transform duration-100
        hover:scale-125
      "
      style={{
        backgroundColor: bg,
        outline: isToday ? '1px solid rgba(255,161,22,0.6)' : undefined,
        outlineOffset: '1px',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  )
}

export default function ActivityChart({ activityData = {} }) {
  const [tooltip, setTooltip] = useState(null)

  const { weeks } = useMemo(() => buildGrid(activityData), [activityData])
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks])

  const total = useMemo(
    () => Object.values(activityData).reduce((s, n) => s + n, 0),
    [activityData]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Activity
          <span className="ml-2 text-xs font-normal text-gray-500">last 12 weeks</span>
        </h3>
        <span className="text-xs text-gray-500">
          <span className="text-[#FFA116] font-semibold">{total}</span> submissions
        </span>
      </div>

      {/* Grid container */}
      <div className="p-4 rounded-xl bg-[#111111] border border-white/5 overflow-x-auto">
        {/* Month labels */}
        <div className="flex mb-1.5 pl-7">
          {(() => {
            const cols = []
            let lastCol = -1
            monthLabels.forEach(({ month, col }) => {
              if (lastCol !== -1) {
                const gap = col - lastCol
                if (gap > 1) {
                  cols.push(
                    <div key={`gap-${col}`} style={{ width: (gap - 1) * 16 }} />
                  )
                }
              }
              cols.push(
                <div key={month + col} className="text-[10px] text-gray-500 font-mono w-4">
                  {month}
                </div>
              )
              lastCol = col
            })
            return cols
          })()}
        </div>

        {/* Day labels + activity grid */}
        <div className="flex gap-1">
          <div className="flex flex-col gap-0.5 mr-1.5">
            {DAY_LABELS.map((d) => (
              <div key={d} className="h-3 flex items-center justify-end">
                <span className="text-[10px] text-gray-600 font-mono w-5 text-right">
                  {SHORT_DAY[d] ?? ''}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((date, di) => {
                  const key   = toKey(date)
                  const count = activityData[key] ?? 0
                  return (
                    <Cell
                      key={key}
                      date={date}
                      count={count}
                      onMouseEnter={(e) =>
                        setTooltip({ date: key, count, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-[10px] text-gray-600">Less</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: cellColor(n).bg }}
            />
          ))}
          <span className="text-[10px] text-gray-600">More</span>
        </div>
      </div>

      {tooltip && (
        <Tooltip
          date={tooltip.date}
          count={tooltip.count}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  )
}
