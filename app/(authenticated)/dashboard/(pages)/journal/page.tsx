import { listTradesByUserPaged, createTrade } from "@/actions/trades"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { uploadScreenshot } from "@/actions/storage"
import ScreenshotUploadRow from "@/components/utility/screenshot-upload-row"
import SaveToast from "@/components/utility/save-toast"
import { extractTradeFromImage, type ExtractedTrade } from "@/actions/extract"

export const dynamic = "force-dynamic"

async function createTradeAction(formData: FormData) {
  "use server"

  const symbol = String(formData.get("symbol") || "").trim()
  const timeframe = String(formData.get("timeframe") || "").trim() || null
  const position = String(formData.get("position") || "").trim() || null
  const totalPositionSize = formData.get("totalPositionSize")
    ? Number(formData.get("totalPositionSize"))
    : null
  const positionSizes = String(formData.get("positionSizes") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !Number.isNaN(n))
  const entryPrices = String(formData.get("entryPrices") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !Number.isNaN(n))
  const stopLoss = formData.get("stopLoss") ? Number(formData.get("stopLoss")) : null
  const takeProfit = String(formData.get("takeProfit") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !Number.isNaN(n))
  const additionalNotes = String(formData.get("additionalNotes") || "").trim() || null
  const observation = String(formData.get("observation") || "").trim() || null
  const profitLoss = formData.get("profitLoss") ? Number(formData.get("profitLoss")) : null
  const pips = formData.get("pips") ? Number(formData.get("pips")) : null
  // Allow only one screenshot URL for now
  const firstScreenshot = String(formData.get("screenshots") || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)[0]
  const screenshots = firstScreenshot ? [firstScreenshot] : []
  // Derive tradeDirection from position when not provided
  const tradeDirection = position
    ? position.toLowerCase() === "buy"
      ? "bullish"
      : position.toLowerCase() === "sell"
      ? "bearish"
      : null
    : null

  if (!symbol) {
    throw new Error("Missing required field: symbol")
  }
  if (entryPrices.length === 0) {
    throw new Error("Provide at least one entry price")
  }

  // Round all numeric values to 2 decimals before storing for consistency in display
  const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)
  const r2arr = (arr: number[]) => arr.map(n => Math.round(n * 100) / 100)

  const result = await createTrade({
    symbol,
    timeframe,
    position,
    positionSizes: positionSizes.length ? r2arr(positionSizes) : null,
    totalPositionSize: r2(totalPositionSize),
    entryPrices: r2arr(entryPrices),
    stopLoss: r2(stopLoss),
    takeProfit: r2arr(takeProfit),
    tradeDirection,
    additionalNotes,
    observation,
    profitLoss: r2(profitLoss),
    pips,
    screenshotUrl: screenshots[0] ?? null
  })

  // Ensure the list below is refreshed without manual reload
  revalidatePath("/dashboard/journal")

  if ((result as any)?.ok) {
    redirect("/dashboard/journal?saved=1")
  } else {
    redirect("/dashboard/journal?error=save_failed")
  }
}

export default async function JournalPage({
  searchParams
}: {
  // In Next.js App Router, searchParams is a Promise in async components
  searchParams: Promise<{ screenshot?: string; screenshotPath?: string; page?: string }>
}) {
  const params = await searchParams
  const pageParam = params?.page ? Number(params.page) : 1
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = 10
  const { items: trades, hasNext, hasPrev } = await listTradesByUserPaged(page, pageSize)

  // If a screenshot was uploaded, try to extract fields via vision model
  const screenshotUrl = params?.screenshot
  const screenshotPath = params?.screenshotPath
  let extracted: ExtractedTrade | null = null
  if (screenshotUrl) {
    extracted = await extractTradeFromImage(screenshotUrl)
  }

  // Helper defaults for uncontrolled inputs
  const def = <T,>(v: T | null | undefined, fallback: string = "") =>
    v === null || v === undefined ? fallback : String(v)

  const defaultTargets = extracted?.targets?.length ? extracted.targets.join(", ") : ""
  const defaultPosition = extracted?.direction
    ? extracted.direction === "long"
      ? "buy"
      : "sell"
    : ""

  return (
    <div className="space-y-10">
      <SaveToast />
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-muted-foreground mt-2">Log trades quickly with minimal fields.</p>
      </div>

      {/* Narrow, centered editor column */}
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Upload screenshot (card at top, visually part of form) */}
        <form action={uploadScreenshot} className="rounded-md border p-3">
          <ScreenshotUploadRow screenshotUrl={screenshotUrl} />
        </form>

        <form action={createTradeAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Row 1: Symbol + Position */}
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input name="symbol" id="symbol" placeholder="EURUSD" required defaultValue={def(extracted?.symbol)} />
          </div>
          <div>
            <Label htmlFor="position">Position</Label>
            <select
              name="position"
              id="position"
              className="border-input bg-background text-foreground inline-flex h-10 w-full items-center justify-center rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue={defaultPosition}
            >
              <option value="">Select</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
        {/* Row 2: Timeframe + Total position size */}
        <div>
          <Label htmlFor="timeframe">Timeframe</Label>
          <Input name="timeframe" id="timeframe" placeholder="M1 / M15 / H1" defaultValue={def(extracted?.timeframe)} />
        </div>
        <div>
          <Label htmlFor="totalPositionSize">Total position size (lots)</Label>
          <Input name="totalPositionSize" id="totalPositionSize" type="number" step="0.0001" />
        </div>
        <div>
          <Label htmlFor="entryPrices">Entry price(s)</Label>
          <Input
            name="entryPrices"
            id="entryPrices"
            placeholder="3634.83, 3628.43, ..."
            defaultValue={Array.isArray(extracted?.entryList) && extracted.entryList.length
              ? extracted.entryList.join(", ")
              : def(extracted?.entry)}
          />
        </div>
        <div>
          <Label htmlFor="stopLoss">Stop loss</Label>
          <Input name="stopLoss" id="stopLoss" type="number" step="0.00001" defaultValue={def(extracted?.stop)} />
        </div>
        <div>
          <Label htmlFor="takeProfit">Take profit (comma separated)</Label>
          <Input name="takeProfit" id="takeProfit" placeholder="3630.00, ..." defaultValue={defaultTargets} />
        </div>
        <div>
          <Label htmlFor="positionSizes">Position size(s) (comma separated)</Label>
          <Input
            name="positionSizes"
            id="positionSizes"
            placeholder="0.05, 0.05, 0.05"
            defaultValue={Array.isArray(extracted?.positionSizes) && extracted.positionSizes.length
              ? extracted.positionSizes.join(", ")
              : ""}
          />
        </div>
        {/* Collapsible Notes section */}
        <details className="md:col-span-2 rounded-md border bg-card/50 p-3">
          <summary className="cursor-pointer select-none text-sm font-medium">Notes</summary>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="additionalNotes">Additional notes</Label>
              <Textarea
                name="additionalNotes"
                id="additionalNotes"
                placeholder="Why this trade? Key context & invalidation."
                rows={3}
                defaultValue={extracted?.additionalNotes ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="observation">Observation</Label>
              <Textarea name="observation" id="observation" rows={3} defaultValue={def(extracted?.observation)} />
            </div>
          </div>
        </details>

        {/* Results row: P/L & Pips */}
        <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="profitLoss">P/L</Label>
            <Input name="profitLoss" id="profitLoss" type="number" step="0.01" />
          </div>
          <div>
            <Label htmlFor="pips">Pips</Label>
            <Input name="pips" id="pips" type="number" step="1" />
          </div>
        </div>
        {/* Hidden field to persist screenshot path (stable); fall back to signed URL if path missing */}
        <input type="hidden" name="screenshots" value={screenshotPath ? screenshotPath : (screenshotUrl ? screenshotUrl : "")} />
        {/* Removed bottom large preview; inline preview appears in the upload card above */}

          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit">Save Trade</Button>
            {screenshotUrl && (
              <span className="text-xs text-muted-foreground">Fields prefilled from screenshot where possible.</span>
            )}
          </div>
        </form>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-3">
        <h2 className="text-xl font-semibold">Recent trades</h2>
        <div className="divide-border rounded-md border">
          {trades.length === 0 ? (
            <div className="text-muted-foreground p-4 text-sm">No trades yet.</div>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-2 gap-2 border-b bg-muted/30 p-3 text-xs font-medium text-muted-foreground md:grid-cols-6">
                <div>Symbol</div>
                <div>Position</div>
                <div className="text-right">Entry</div>
                <div className="text-right">Position size</div>
                <div className="text-right">P/L</div>
                <div>Date</div>
              </div>
              {trades.map(t => {
                const posSize =
                  (t.totalPositionSize as unknown as number | null) ??
                  (Array.isArray(t.positionSizes) && t.positionSizes.length
                    ? (t.positionSizes[0] as unknown as number)
                    : null)
                return (
                  <Link
                    key={t.id}
                    href={`/dashboard/journal/${t.id}`}
                    className="grid grid-cols-2 gap-2 border-b p-4 last:border-b-0 transition-colors hover:bg-accent/40 md:grid-cols-6"
                  >
                    <div className="font-medium">{t.symbol}</div>
                    <div className="uppercase text-xs">{t.position ?? "-"}</div>
                    <div className="text-right text-sm">
                      Entry {Array.isArray(t.entryPrices) && t.entryPrices.length ? Number(t.entryPrices[0] as unknown as number).toFixed(2) : "-"}
                    </div>
                    <div className="text-right text-sm">{posSize != null ? Number(posSize).toFixed(2) : "-"}</div>
                    <div className="text-right text-sm">{t.profitLoss != null ? Number(t.profitLoss as unknown as number).toFixed(2) : "-"}</div>
                    <div className="text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleString()}</div>
                  </Link>
                )
              })}
            </>
          )}
        </div>
        {/* Pagination controls */}
        <div className="flex items-center justify-between py-2">
          <div className="text-xs text-muted-foreground">Page {page}</div>
          <div className="flex gap-2">
            <a
              aria-disabled={!hasPrev}
              className={`border-input inline-flex h-9 items-center rounded-md border px-3 text-sm ${!hasPrev ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}
              href={`/dashboard/journal?page=${Math.max(1, page - 1)}`}
            >
              Prev
            </a>
            <a
              aria-disabled={!hasNext}
              className={`border-input inline-flex h-9 items-center rounded-md border px-3 text-sm ${!hasNext ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}
              href={`/dashboard/journal?page=${page + 1}`}
            >
              Next
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
