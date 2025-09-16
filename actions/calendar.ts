"use server"

import { db } from "@/db"
import { trades } from "@/db/schema/trades"
import { auth } from "@clerk/nextjs/server"
import { and, eq, gte, lte } from "drizzle-orm"

export type CalendarView = "day" | "week" | "month"

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() // 0=Sun
  const diff = (day + 6) % 7 // make Monday=0
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export async function getCalendarRange(view: CalendarView, anchorISO?: string) {
  const { userId } = await auth()
  if (!userId) return null

  const anchor = anchorISO ? new Date(anchorISO) : new Date()

  let start: Date
  let end: Date
  if (view === "day") {
    start = startOfDay(anchor)
    end = endOfDay(anchor)
  } else if (view === "week") {
    start = startOfWeek(anchor)
    end = endOfWeek(anchor)
  } else {
    const b = monthGridBounds(anchor)
    start = b.gridStart
    end = b.gridEnd
  }

  const rows = await db.query.trades.findMany({
    where: and(eq(trades.userId, userId), gte(trades.createdAt, start), lte(trades.createdAt, end)),
    orderBy: trades.createdAt
  })

  return {
    view,
    start: start.toISOString(),
    end: end.toISOString(),
    anchor: anchor.toISOString(),
    trades: rows.map(r => ({
      id: r.id,
      createdAt: (r.createdAt as Date).toISOString(),
      symbol: r.symbol,
      position: r.position,
      profitLoss: r.profitLoss ? Number(r.profitLoss) : null,
      timeframe: r.timeframe ?? null
    }))
  }
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}

function startOfDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

function endOfDay(d: Date): Date {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e
}

function monthGridBounds(anchor: Date): { gridStart: Date; gridEnd: Date } {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const gridStart = startOfWeek(first)
  const gridEnd = endOfWeek(last)
  return { gridStart, gridEnd }
}

export async function getCalendarMonth(anchorISO?: string) {
  const { userId } = await auth()
  if (!userId) return null

  const anchor = anchorISO ? new Date(anchorISO) : new Date()
  const { gridStart, gridEnd } = monthGridBounds(anchor)

  const rows = await db.query.trades.findMany({
    where: and(
      eq(trades.userId, userId),
      gte(trades.createdAt, gridStart),
      lte(trades.createdAt, gridEnd)
    ),
    orderBy: trades.createdAt
  })

  // Group by day
  const byDay = new Map<string, typeof rows>()
  for (const r of rows) {
    const d = new Date(r.createdAt as Date)
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const arr = byDay.get(key) ?? []
    arr.push(r)
    byDay.set(key, arr)
  }

  // Build cells
  const cells: Array<{
    dateISO: string
    inMonth: boolean
    chips: Array<{ id: string; symbol: string; position: string | null; profitLoss: number | null; timeframe: string | null }>
    more: number
  }> = []

  const dayMillis = 24 * 60 * 60 * 1000
  for (let t = gridStart.getTime(); t <= gridEnd.getTime(); t += dayMillis) {
    const d = new Date(t)
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const rowsForDay = byDay.get(key) ?? []
    const chips = rowsForDay.slice(0, 3).map(r => ({
      id: r.id,
      symbol: r.symbol,
      position: r.position,
      profitLoss: r.profitLoss ? Number(r.profitLoss) : null,
      timeframe: r.timeframe ?? null
    }))
    const more = Math.max(0, rowsForDay.length - chips.length)
    cells.push({
      dateISO: key,
      inMonth: d.getMonth() === anchor.getMonth(),
      chips,
      more
    })
  }

  return {
    anchor: anchor.toISOString(),
    gridStart: gridStart.toISOString(),
    gridEnd: gridEnd.toISOString(),
    month: anchor.getMonth(),
    year: anchor.getFullYear(),
    cells
  }
}
