import { pgEnum, pgTable, text, timestamp, uuid, numeric, integer, boolean } from "drizzle-orm/pg-core"

export const direction = pgEnum("direction", ["long", "short"]) 

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  direction: direction("direction").notNull(),
  entry: numeric("entry", { precision: 18, scale: 8 }).notNull(),
  stop: numeric("stop", { precision: 18, scale: 8 }).notNull(),
  sizeRiskPct: numeric("size_risk_pct", { precision: 10, scale: 4 }).notNull(),
  targets: text("targets"), // comma-separated targets for MVP
  setupTags: text("setup_tags").array().default([]),
  thesis: text("thesis"),
  pl: numeric("pl", { precision: 18, scale: 2 }), // P/L in account currency
  pips: integer("pips"),
  rMultiple: numeric("r_multiple", { precision: 10, scale: 4 }),
  screenshots: text("screenshots").array().default([]), // array of URL strings
  rule1: boolean("rule_1"),
  rule2: boolean("rule_2"),
  rule3: boolean("rule_3"),
  lesson: text("lesson"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type InsertTrade = typeof trades.$inferInsert
export type SelectTrade = typeof trades.$inferSelect
