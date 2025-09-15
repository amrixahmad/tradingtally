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

export async function createTrade(values: Omit<InsertTrade, "id" | "userId" | "createdAt">) {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false as const, error: "Not authenticated" }
  }

  try {
    const [row] = await db
      .insert(trades)
      .values({
        ...values,
        userId
      })
      .returning()

    return { ok: true as const, data: row }
  } catch (error) {
    console.error("Error creating trade:", error)
    return { ok: false as const, error: "Failed to create trade" }
  }
}
