import { getCalendarMonth, getCalendarRange, type CalendarView } from "@/actions/calendar"
import Link from "next/link"

export const dynamic = "force-dynamic"

function formatMonthYear(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" })
}

function parseView(sp: Record<string, string>): CalendarView {
  const v = sp["view"] || "month"
  if (v === "day" || v === "week" || v === "month") return v
  return "month"
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const anchorISO = sp["date"]
  const view = parseView(sp)

  // Month data (grid) always needed for month view
  const monthData = await getCalendarMonth(anchorISO)
  if (!monthData) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="text-muted-foreground">Sign in to view your calendar.</div>
      </div>
    )
  }

  const rangeData = await getCalendarRange(view, anchorISO)
  const anchor = new Date(monthData.anchor)
  const prev = new Date(anchor); prev.setMonth(anchor.getMonth() - 1)
  const next = new Date(anchor); next.setMonth(anchor.getMonth() + 1)

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">{formatMonthYear(anchor)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="border px-3 py-1 rounded-md text-sm" href={`/dashboard/calendar?view=${view}&date=${prev.toISOString()}`}>Prev</Link>
          <Link className="border px-3 py-1 rounded-md text-sm" href={`/dashboard/calendar?view=${view}&date=${new Date().toISOString()}`}>Today</Link>
          <Link className="border px-3 py-1 rounded-md text-sm" href={`/dashboard/calendar?view=${view}&date=${next.toISOString()}`}>Next</Link>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-2 text-sm">
        <Link className={`rounded-md border px-3 py-1 ${view==='day' ? 'bg-accent' : ''}`} href={`/dashboard/calendar?view=day${anchorISO ? `&date=${anchorISO}` : ''}`}>Day</Link>
        <Link className={`rounded-md border px-3 py-1 ${view==='week' ? 'bg-accent' : ''}`} href={`/dashboard/calendar?view=week${anchorISO ? `&date=${anchorISO}` : ''}`}>Week</Link>
        <Link className={`rounded-md border px-3 py-1 ${view==='month' ? 'bg-accent' : ''}`} href={`/dashboard/calendar?view=month${anchorISO ? `&date=${anchorISO}` : ''}`}>Month</Link>
      </div>

      {view === 'month' && (
        <>
          <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
            {daysOfWeek.map(d => (
              <div key={d} className="px-2 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthData.cells.map((cell, idx) => {
              const d = new Date(cell.dateISO)
              const isToday = new Date().toDateString() === d.toDateString()
              const inMonth = cell.inMonth
              const dayISO = d.toISOString()
              return (
                <div key={idx} className={`rounded-md border p-2 ${inMonth ? '' : 'opacity-50'} ${isToday ? 'ring-2 ring-primary' : ''}`}>
                  <div className="mb-1 flex items-center justify-between text-xs font-medium">
                    <span>{d.getDate()}</span>
                    <Link href={`/dashboard/calendar?view=day&date=${dayISO}`} className="text-muted-foreground hover:underline">View</Link>
                  </div>
                  <div className="space-y-1">
                    {cell.chips.map(c => {
                      const isPos = (c.profitLoss ?? 0) > 0
                      const pl = c.profitLoss != null ? c.profitLoss.toFixed(2) : '•'
                      return (
                        <Link
                          key={c.id}
                          href={`/dashboard/journal/${c.id}`}
                          className={`block truncate rounded px-2 py-1 text-xs ${isPos ? 'bg-green-500/15 text-green-700' : (c.profitLoss != null ? 'bg-red-500/15 text-red-700' : 'bg-muted text-foreground')}`}
                          title={`${c.symbol} ${c.position ?? ''} ${pl} ${c.timeframe ?? ''}`}
                        >
                          {c.symbol} {c.position ? c.position.toUpperCase() : ''} {pl} {c.timeframe ?? ''}
                        </Link>
                      )
                    })}
                    {cell.more > 0 && (
                      <Link href={`/dashboard/calendar?view=day&date=${dayISO}`} className="text-xs text-muted-foreground hover:underline">+{cell.more} more</Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'week' && rangeData && (
        <>
          <div className="text-sm text-muted-foreground">Week of {new Date(rangeData.start).toLocaleDateString()} - {new Date(rangeData.end).toLocaleDateString()}</div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(rangeData.start)
              d.setDate(new Date(rangeData.start).getDate() + i)
              const dayISO = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
              const items = rangeData.trades.filter(t => {
                const td = new Date(t.createdAt)
                const key = new Date(td.getFullYear(), td.getMonth(), td.getDate()).toISOString()
                return key === dayISO
              })
              return (
                <div key={i} className="rounded-md border p-2">
                  <div className="mb-1 text-xs font-medium">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  <div className="space-y-1">
                    {items.length === 0 ? (
                      <div className="text-xs text-muted-foreground">—</div>
                    ) : (
                      items.map(t => {
                        const isPos = (t.profitLoss ?? 0) > 0
                        const pl = t.profitLoss != null ? t.profitLoss.toFixed(2) : '•'
                        return (
                          <Link key={t.id} href={`/dashboard/journal/${t.id}`} className={`block truncate rounded px-2 py-1 text-xs ${isPos ? 'bg-green-500/15 text-green-700' : (t.profitLoss != null ? 'bg-red-500/15 text-red-700' : 'bg-muted text-foreground')}`}>
                            {t.symbol} {t.position ? t.position.toUpperCase() : ''} {pl} {t.timeframe ?? ''}
                          </Link>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'day' && rangeData && (
        <>
          <div className="text-sm text-muted-foreground">{new Date(rangeData.start).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div className="rounded-md border">
            {rangeData.trades.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No trades for this day.</div>
            ) : (
              rangeData.trades
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map(t => {
                  const isPos = (t.profitLoss ?? 0) > 0
                  const pl = t.profitLoss != null ? t.profitLoss.toFixed(2) : '•'
                  const time = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  return (
                    <Link key={t.id} href={`/dashboard/journal/${t.id}`} className="flex items-center justify-between border-b p-3 text-sm last:border-b-0 hover:bg-accent/40">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14">{time}</span>
                        <span>{t.symbol}</span>
                        <span className="uppercase text-xs text-muted-foreground">{t.position ?? ''}</span>
                        <span className="text-xs text-muted-foreground">{t.timeframe ?? ''}</span>
                      </div>
                      <span className={`${isPos ? 'text-green-600' : (t.profitLoss != null ? 'text-red-600' : 'text-foreground')}`}>{pl}</span>
                    </Link>
                  )
                })
            )}
          </div>
        </>
      )}
    </div>
  )
}
