// Server-only utilities

import { db } from "@/db"
import { trades, type InsertTrade, type SelectTrade } from "@/db/schema/trades"
import { auth } from "@clerk/nextjs/server"
import { and, desc, eq } from "drizzle-orm"

export async function listTradesByUser(): Promise<SelectTrade[]> {
  const { userId } = await auth()
  if (!userId) return []

  try {
    const rows = await db.query.trades.findMany({
      where: eq(trades.userId, userId),
      orderBy: desc(trades.createdAt)
    })
    return rows
  } catch (error) {
    console.error("Error listing trades:", error)
    return []
  }
}

// Update a single trade's editable fields (numbers already rounded in caller)
export async function updateTrade(
  id: string,
  values: {
    entryPrices?: number[] | null
    stopLoss?: number | null
    takeProfit?: number[] | null
    positionSizes?: number[] | null
    totalPositionSize?: number | null
    profitLoss?: number | null
    additionalNotes?: string | null
    observation?: string | null
  }
) {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false as const, error: "Not authenticated" }
  }

  const toStringArray = (arr: number[] | null | undefined): string[] | null => {
    if (!arr || arr.length === 0) return null
    return arr.map(n => String(n))
  }
  const toStringOrNull = (n: number | null | undefined): string | null =>
    n == null ? null : String(n)

  try {
    const payload: Partial<InsertTrade> = {
      entryPrices: toStringArray(values.entryPrices),
      stopLoss: toStringOrNull(values.stopLoss) as unknown as any,
      takeProfit: toStringArray(values.takeProfit),
      positionSizes: toStringArray(values.positionSizes),
      totalPositionSize: toStringOrNull(values.totalPositionSize) as unknown as any,
      profitLoss: toStringOrNull(values.profitLoss) as unknown as any,
      additionalNotes: values.additionalNotes ?? null,
      observation: values.observation ?? null
    }

    const [row] = await db
      .update(trades)
      .set(payload)
      .where(and(eq(trades.userId, userId), eq(trades.id, id)))
      .returning()

    return { ok: true as const, data: row }
  } catch (error) {
    console.error("Error updating trade:", error)
    return { ok: false as const, error: "Failed to update trade" }
  }
}

// (pagination handled in page via slicing for now)

// Accept a flexible payload from the form and normalize server-side
export async function createTrade(values: any) {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false as const, error: "Not authenticated" }
  }

  try {
    // Normalize arrays to string[] for Drizzle numeric[] columns (which infer as string[])
    const toStringArray = (arr: unknown): string[] | null => {
      if (!Array.isArray(arr)) return null
      const mapped = arr
        .map(v => (v == null ? null : typeof v === "string" ? v : String(v)))
        .filter((v): v is string => typeof v === "string" && v.length > 0)
      return mapped.length ? mapped : null
    }

    const insertValues: InsertTrade = {
      userId,
      symbol: values.symbol,
      timeframe: values.timeframe ?? null,
      position: values.position ?? null,
      positionSizes: toStringArray(values.positionSizes) ?? null,
      totalPositionSize: values.totalPositionSize ?? null,
      entryPrices: toStringArray(values.entryPrices) ?? null,
      stopLoss: values.stopLoss ?? null,
      takeProfit: toStringArray(values.takeProfit) ?? null,
      tradeDirection: values.tradeDirection ?? null,
      additionalNotes: values.additionalNotes ?? null,
      observation: values.observation ?? null,
      profitLoss: values.profitLoss ?? null,
      pips: values.pips ?? null,
      screenshotUrl: values.screenshotUrl ?? null
    }

    const [row] = await db.insert(trades).values(insertValues).returning()

    return { ok: true as const, data: row }
  } catch (error) {
    console.error("Error creating trade:", error)
    return { ok: false as const, error: "Failed to create trade" }
  }
}

// Fetch a single trade by id (scoped to current user)
export async function getTradeById(id: string): Promise<SelectTrade | null> {
  const { userId } = await auth()
  if (!userId) return null
  try {
    const rows = await db
      .select()
      .from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.id, id)))
      .limit(1)
    return rows[0] ?? null
  } catch (error) {
    console.error("Error fetching trade by id:", error)
    return null
  }
}

// DB-level pagination
export async function listTradesByUserPaged(
  page: number = 1,
  pageSize: number = 10
): Promise<{
  items: SelectTrade[]
  hasNext: boolean
  hasPrev: boolean
  page: number
  pageSize: number
}> {
  const { userId } = await auth()
  if (!userId) return { items: [], hasNext: false, hasPrev: false, page: 1, pageSize }

  const safePage = Math.max(1, Math.floor(Number(page) || 1))
  const size = Math.max(1, Math.floor(Number(pageSize) || 10))
  const offset = (safePage - 1) * size

  try {
    const rows = await db.query.trades.findMany({
      where: eq(trades.userId, userId),
      orderBy: desc(trades.createdAt),
      limit: size + 1, // fetch one extra to detect "hasNext"
      offset
    })
    const hasNext = rows.length > size
    const items = hasNext ? rows.slice(0, size) : rows
    const hasPrev = safePage > 1
    return { items, hasNext, hasPrev, page: safePage, pageSize: size }
  } catch (error) {
    console.error("Error listing paged trades:", error)
    return { items: [], hasNext: false, hasPrev: safePage > 1, page: safePage, pageSize: size }
  }
}
