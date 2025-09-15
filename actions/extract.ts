"use server"

import OpenAI from "openai"

// Raw JSON shape from the LLM Responses API
type LlmRawTrade = {
  symbol?: string | null
  timeframe?: string | null
  position?: string | null
  position_sizes?: Array<number | string | null> | null
  total_position_size?: number | string | null
  entry_prices?: Array<number | string> | null
  stop_loss?: number | string | null
  take_profit?: number | string | Array<number | string> | null
  trade_direction?: string | null
  additional_notes?: string | null
  observation?: string | null
  // Back-compat keys we might still see
  direction?: string | null
  entry?: number | string | null
  stop?: number | string | null
  targets?: Array<number | string> | null
  lots?: number | string | null
}
export type ExtractedTrade = {
  symbol: string | null
  direction: "long" | "short" | null
  entry: number | null
  entryList?: number[]
  stop: number | null
  targets: number[]
  lots: number | null
  timeframe: string | null
  additionalNotes?: string | null
  observation?: string | null
  positionSizes?: number[]
}

const systemPrompt = `You will help traders journal their trades based on their trade screenshots that they give you. You will format the output in clean json. Use the following as an example output:

{
  "symbol": "XAUUSD",
  "timeframe": "H1",
  "position": "buy",
  "position_sizes": [0.5, 0.5, 0.5]
   "total_position_size": 0.15,
  "entry_prices": [3628.43, 3627.88, 3627.50],
  "stop_loss": null,
  "take_profit": null,
  "trade_direction": "bullish",
  "additional_notes": "Multiple entries at similar price levels, averaging position entry",
  "observation": "Price declined significantly before the buy entries, indicating potential reversal or support level worked"
}`

export async function extractTradeFromImage(signedUrl: string): Promise<ExtractedTrade | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn("OPENAI_API_KEY missing; skipping extraction")
    return null
  }

  const client = new OpenAI({ apiKey })

  try {
    // Use the Responses API for multimodal extraction with 4.1 models
    const resp = await client.responses.create({
      model: "gpt-4.1-nano",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract information from the image provided based on the system instructions and return ONLY JSON."
            },
            { type: "input_image", image_url: signedUrl, detail: "auto" }
          ]
        }
      ],
      text: { format: { type: "json_object" } }
    })

    // Prefer the convenience field when available
    const content = (resp as any).output_text
      ?? (resp as any).content
      ?? JSON.stringify((resp as any).output?.[0]?.content?.[0]?.text ?? {})
      ?? "{}"
    const raw: LlmRawTrade = JSON.parse(String(content)) as LlmRawTrade

    // Normalize both our expected schema and the user's custom schema
    const normalized: ExtractedTrade = {
      symbol: raw.symbol ?? null,
      direction: null,
      entry: null,
      entryList: [],
      stop: null,
      targets: [],
      lots: null,
      timeframe: raw.timeframe ?? null,
      additionalNotes: null,
      observation: null,
    }

    // Direction mapping: our schema (long/short) or custom (position: buy/sell)
    const dir = raw.direction ?? raw.trade_direction ?? raw.position
    if (typeof dir === "string") {
      const d = dir.toLowerCase()
      if (d === "long" || d === "buy" || d === "bullish") normalized.direction = "long"
      else if (d === "short" || d === "sell" || d === "bearish") normalized.direction = "short"
    }

    // Entry: support entry or entry_prices; store list and first for convenience
    if (typeof raw.entry === "number") normalized.entry = raw.entry
    if (Array.isArray(raw.entry_prices) && raw.entry_prices.length > 0) {
      const list = raw.entry_prices
        .map((v: any) => (typeof v === "string" ? Number(v) : v))
        .filter((v: any) => typeof v === "number" && !Number.isNaN(v))
      if (list.length) {
        normalized.entryList = list
        if (normalized.entry == null) normalized.entry = list[0]
      }
    }

    // Stop: stop or stop_loss
    if (typeof raw.stop === "number") normalized.stop = raw.stop
    else if (raw.stop_loss != null) {
      const n = Number(raw.stop_loss)
      if (!Number.isNaN(n)) normalized.stop = n
    }

    // Targets: targets[] or take_profit (number or array)
    if (Array.isArray(raw.targets)) {
      normalized.targets = raw.targets
        .map((v: any) => (typeof v === "string" ? Number(v) : v))
        .filter((v: any) => typeof v === "number" && !Number.isNaN(v))
    } else if (raw.take_profit != null) {
      if (Array.isArray(raw.take_profit)) {
        normalized.targets = raw.take_profit
          .map((v: any) => (typeof v === "string" ? Number(v) : v))
          .filter((v: any) => typeof v === "number" && !Number.isNaN(v))
      } else {
        const n = Number(raw.take_profit)
        if (!Number.isNaN(n)) normalized.targets = [n]
      }
    }

    // Lots & position sizes: lots | total_position_size | position_sizes[]
    if (typeof raw.lots === "number") normalized.lots = raw.lots
    else if (raw.total_position_size != null) {
      const n = Number(raw.total_position_size)
      if (!Number.isNaN(n)) normalized.lots = n
    }
    if (Array.isArray(raw.position_sizes) && raw.position_sizes.length > 0) {
      const sizes = raw.position_sizes
        .map((v: any) => (v == null ? null : typeof v === "string" ? Number(v) : v))
        .filter((v: any) => typeof v === "number" && !Number.isNaN(v))
      if (sizes.length) {
        normalized.positionSizes = sizes as number[]
        if (normalized.lots == null) {
          const sum = sizes.reduce((a: number, b: number) => a + b, 0)
          if (!Number.isNaN(sum)) normalized.lots = sum
        }
      }
    }

    // Notes
    const notes: string[] = []
    if (typeof raw.additional_notes === "string" && raw.additional_notes.trim()) {
      notes.push(raw.additional_notes.trim())
      normalized.additionalNotes = raw.additional_notes.trim()
    }
    if (typeof raw.observation === "string" && raw.observation.trim()) {
      notes.push(raw.observation.trim())
      normalized.observation = raw.observation.trim()
    }

    // Targets coercion if came as strings
    normalized.targets = Array.isArray(normalized.targets)
      ? normalized.targets
          .map(v => (typeof v === "string" ? Number(v) : v))
          .filter(v => typeof v === "number" && !Number.isNaN(v))
      : []

    return normalized
  } catch (error) {
    console.error("Vision extraction failed:", error)
    return null
  }
}
