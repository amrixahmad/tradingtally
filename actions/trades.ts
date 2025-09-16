"use server"

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
