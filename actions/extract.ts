"use server"

import OpenAI from "openai"

export type ExtractedTrade = {
  symbol: string | null
  direction: "long" | "short" | null
  entry: number | null
  stop: number | null
  targets: number[]
  lots: number | null
  timeframe: string | null
  notesFromImage: string[]
  confidences: Partial<Record<keyof Omit<ExtractedTrade, "confidences">, number>>
}

const systemPrompt = `You are parsing a mobile MT5 (MetaTrader 5) screenshot. Return a strict JSON object with the following keys.
- symbol: e.g. XAUUSD, EURUSD (null if unsure)
- direction: "long" or "short" if BUY/SELL is clearly indicated; otherwise null
- entry: number (price) if a clear entry/order line price is present, else null
- stop: number if an SL line/label is visible, else null
- targets: array of numbers for any TP lines/labels found ([] if none)
- lots: numeric lot size if visible, else null (e.g., BUY 0.05 -> 0.05)
- timeframe: e.g. H1, M15, H4
- notesFromImage: short strings of any relevant labels you observed (BUY 0.05, SL 1.0950, etc.)
- confidences: object mapping field -> 0..1 confidence
If unsure about a field, set it to null and a low confidence.`

export async function extractTradeFromImage(signedUrl: string): Promise<ExtractedTrade | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn("OPENAI_API_KEY missing; skipping extraction")
    return null
  }

  const client = new OpenAI({ apiKey })

  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Parse this MT5 screenshot and return the JSON only." },
            { type: "image_url", image_url: { url: signedUrl } }
          ] as any
        }
      ],
      response_format: { type: "json_object" }
    })

    const content = resp.choices[0]?.message?.content || "{}"
    const data = JSON.parse(content) as ExtractedTrade

    if (data.direction && !["long", "short"].includes(data.direction)) {
      data.direction = null
    }

    data.targets = Array.isArray(data.targets)
      ? data.targets
          .map(v => (typeof v === "string" ? Number(v) : v))
          .filter(v => typeof v === "number" && !Number.isNaN(v))
      : []

    return data
  } catch (error) {
    console.error("Vision extraction failed:", error)
    return null
  }
}
