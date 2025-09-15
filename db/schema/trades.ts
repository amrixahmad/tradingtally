import { pgEnum, pgTable, text, timestamp, uuid, numeric, integer } from "drizzle-orm/pg-core"

export const direction = pgEnum("direction", ["long", "short"]) 

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe"),
  // Raw LLM fields (verbatim mapping)
  position: text("position"), // e.g., buy/sell
  positionSizes: numeric("position_sizes", { precision: 12, scale: 4 }).array(), // may include nulls in source; we'll filter on write
  totalPositionSize: numeric("total_position_size", { precision: 12, scale: 4 }),
  entryPrices: numeric("entry_prices", { precision: 18, scale: 8 }).array(),
  stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 18, scale: 8 }).array(),
  tradeDirection: text("trade_direction"), // e.g., bullish/bearish
  additionalNotes: text("additional_notes"),
  observation: text("observation"),
  profitLoss: numeric("profitLoss", { precision: 18, scale: 2 }), // P/L in account currency
  pips: integer("pips"),  
  screenshotUrl: text("screenshot_url"), // single screenshot URL  
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type InsertTrade = typeof trades.$inferInsert
export type SelectTrade = typeof trades.$inferSelect
