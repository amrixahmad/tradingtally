"use server"

import { db } from "@/db"
import { trades } from "@/db/schema/trades"
import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte } from "drizzle-orm"

export type OverviewRange = "7d" | "30d" | "month" | "ytd" | "all"

function rangeToStart(range: OverviewRange): Date | null {
  const now = new Date()
  switch (range) {
    case "7d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    case "30d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d
    }
    case "month": {
      return new Date(now.getFullYear(), now.getMonth(), 1)
    }
    case "ytd": {
      return new Date(now.getFullYear(), 0, 1)
    }
    case "all":
    default:
      return null
  }
}

export async function getOverview(range: OverviewRange = "30d") {
  const { userId } = await auth()
  if (!userId) return null

  const start = rangeToStart(range)

  try {
    const rows = await db.query.trades.findMany({
      where: start
        ? and(eq(trades.userId, userId), gte(trades.createdAt, start))
        : eq(trades.userId, userId),
      orderBy: desc(trades.createdAt)
    })

    // KPIs
    const closed = rows.filter(r => r.profitLoss !== null && r.profitLoss !== undefined)
    const totalPL = closed.reduce((acc, r) => acc + Number(r.profitLoss), 0)
    const winners = closed.filter(r => Number(r.profitLoss) > 0).length
    const winRate = closed.length ? (winners / closed.length) * 100 : 0
    const tradesCount = rows.length
    const avgPL = closed.length ? totalPL / closed.length : 0

    // Equity curve (cumulative P/L over time)
    const eqSeries = [...rows]
      .filter(r => r.profitLoss !== null && r.profitLoss !== undefined)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
      .map(r => ({ date: r.createdAt as Date, pl: Number(r.profitLoss) }))

    const equityCurve: { date: string; value: number }[] = []
    let cum = 0
    for (const p of eqSeries) {
      cum += p.pl
      equityCurve.push({ date: p.date.toISOString(), value: Number(cum.toFixed(2)) })
    }

    // Profit by day
    const byDay = new Map<string, number>()
    for (const r of closed) {
      const d = new Date(r.createdAt as Date)
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
      byDay.set(key, Number((byDay.get(key) ?? 0) + Number(r.profitLoss)))
    }
    const profitByDay = Array.from(byDay.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, value]) => ({ date, value: Number(value.toFixed(2)) }))

    // Instrument breakdown
    type Agg = { trades: number; closed: number; wins: number; pl: number }
    const bySymbol = new Map<string, Agg>()
    for (const r of rows) {
      const key = r.symbol || "-"
      const agg = bySymbol.get(key) ?? { trades: 0, closed: 0, wins: 0, pl: 0 }
      agg.trades++
      if (r.profitLoss !== null && r.profitLoss !== undefined) {
        agg.closed++
        const pl = Number(r.profitLoss)
        agg.pl += pl
        if (pl > 0) agg.wins++
      }
      bySymbol.set(key, agg)
    }
    const instrumentTable = Array.from(bySymbol.entries())
      .map(([symbol, a]) => ({
        symbol,
        trades: a.trades,
        winRate: a.closed ? Number(((a.wins / a.closed) * 100).toFixed(1)) : 0,
        totalPL: Number(a.pl.toFixed(2))
      }))
      .sort((a, b) => b.totalPL - a.totalPL)
      .slice(0, 5)

    // Timeframe breakdown
    const byTf = new Map<string, Agg>()
    for (const r of rows) {
      const key = r.timeframe || "-"
      const agg = byTf.get(key) ?? { trades: 0, closed: 0, wins: 0, pl: 0 }
      agg.trades++
      if (r.profitLoss !== null && r.profitLoss !== undefined) {
        agg.closed++
        const pl = Number(r.profitLoss)
        agg.pl += pl
        if (pl > 0) agg.wins++
      }
      byTf.set(key, agg)
    }
    const timeframeTable = Array.from(byTf.entries())
      .map(([timeframe, a]) => ({
        timeframe,
        trades: a.trades,
        winRate: a.closed ? Number(((a.wins / a.closed) * 100).toFixed(1)) : 0,
        totalPL: Number(a.pl.toFixed(2))
      }))
      .sort((a, b) => b.totalPL - a.totalPL)

    return {
      range,
      kpis: {
        totalPL: Number(totalPL.toFixed(2)),
        winRate: Number(winRate.toFixed(1)),
        tradesCount,
        avgPL: Number(avgPL.toFixed(2))
      },
      equityCurve,
      profitByDay,
      instrumentTable,
      timeframeTable
    }
  } catch (error) {
    console.error("Overview aggregation error:", error)
    return null
  }
}
