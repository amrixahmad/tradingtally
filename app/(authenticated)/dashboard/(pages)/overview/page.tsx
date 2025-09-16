import { getOverview, type OverviewRange } from "@/actions/overview"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

function parseRange(sp: Record<string, string | string[] | undefined>): OverviewRange {
  const r = (sp["range"] as string) || "30d"
  if (r === "7d" || r === "30d" || r === "month" || r === "ytd" || r === "all") return r
  return "30d"
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const range = parseRange(params)
  const data = await getOverview(range)
  if (!data) redirect("/dashboard/journal")

  const fmt = (n: number) => n.toFixed(2)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-muted-foreground text-sm">A snapshot of your recent trading performance.</p>
        </div>
        <form action="/dashboard/overview" method="get" className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="range">Range</label>
          <select
            defaultValue={range}
            id="range"
            name="range"
            className="border-input bg-background text-foreground inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="ytd">YTD</option>
            <option value="all">All time</option>
          </select>
          <Button type="submit" variant="outline" className="h-9">Apply</Button>
        </form>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Total P/L</div>
          <div className="text-xl font-semibold">{fmt(data.kpis.totalPL)}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Win rate</div>
          <div className="text-xl font-semibold">{data.kpis.winRate.toFixed(0)}%</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Trades</div>
          <div className="text-xl font-semibold">{data.kpis.tradesCount}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Avg P/L per trade</div>
          <div className="text-xl font-semibold">{fmt(data.kpis.avgPL)}</div>
        </div>
      </div>

      {/* Equity curve & Profit by day */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4">
          <div className="mb-2 text-sm font-medium text-muted-foreground">Equity curve</div>
          {data.equityCurve.length === 0 ? (
            <div className="text-sm text-muted-foreground">No closed trades in this range.</div>
          ) : (
            <svg viewBox="0 0 600 200" className="h-48 w-full">
              {/* simple line chart without external lib: scale by min/max */}
              {(() => {
                const min = Math.min(...data.equityCurve.map(p => p.value))
                const max = Math.max(...data.equityCurve.map(p => p.value))
                const xs = data.equityCurve.map((_, i) => (i / (data.equityCurve.length - 1 || 1)) * 580 + 10)
                const ys = data.equityCurve.map(p => {
                  if (max === min) return 100
                  return 190 - ((p.value - min) / (max - min)) * 180
                })
                const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x},${ys[i]}`).join(' ')
                return <path d={path} stroke="currentColor" className="text-primary" fill="none" strokeWidth={2} />
              })()}
            </svg>
          )}
        </div>
        <div className="rounded-md border p-4">
          <div className="mb-2 text-sm font-medium text-muted-foreground">Profit by day</div>
          {data.profitByDay.length === 0 ? (
            <div className="text-sm text-muted-foreground">No closed trades in this range.</div>
          ) : (
            <div className="h-48 w-full flex items-end gap-1">
              {(() => {
                const max = Math.max(...data.profitByDay.map(p => Math.abs(p.value))) || 1
                return data.profitByDay.map((p, i) => {
                  const h = Math.round(Math.abs(p.value) / max * 160) + 2
                  const isPos = p.value >= 0
                  return <div key={i} title={`${new Date(p.date).toLocaleDateString()} : ${fmt(p.value)}`} className={`w-2 ${isPos ? 'bg-green-500' : 'bg-red-500'}`} style={{ height: `${h}px` }} />
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4">
          <div className="mb-2 text-sm font-medium text-muted-foreground">Top instruments</div>
          <div className="text-sm">
            <div className="grid grid-cols-4 gap-2 border-b pb-1 text-xs text-muted-foreground">
              <div>Symbol</div><div className="text-right">Trades</div><div className="text-right">Win %</div><div className="text-right">Total P/L</div>
            </div>
            {data.instrumentTable.length === 0 ? (
              <div className="text-muted-foreground py-3 text-xs">No trades</div>
            ) : (
              data.instrumentTable.map((r, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 border-b py-1 last:border-b-0">
                  <div>{r.symbol}</div>
                  <div className="text-right">{r.trades}</div>
                  <div className="text-right">{r.winRate.toFixed(0)}%</div>
                  <div className="text-right">{fmt(r.totalPL)}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="mb-2 text-sm font-medium text-muted-foreground">Timeframes</div>
          <div className="text-sm">
            <div className="grid grid-cols-4 gap-2 border-b pb-1 text-xs text-muted-foreground">
              <div>Timeframe</div><div className="text-right">Trades</div><div className="text-right">Win %</div><div className="text-right">Total P/L</div>
            </div>
            {data.timeframeTable.length === 0 ? (
              <div className="text-muted-foreground py-3 text-xs">No trades</div>
            ) : (
              data.timeframeTable.map((r, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 border-b py-1 last:border-b-0">
                  <div>{r.timeframe}</div>
                  <div className="text-right">{r.trades}</div>
                  <div className="text-right">{r.winRate.toFixed(0)}%</div>
                  <div className="text-right">{fmt(r.totalPL)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
