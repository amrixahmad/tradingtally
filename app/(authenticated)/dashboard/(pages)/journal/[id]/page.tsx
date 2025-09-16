import { getTradeById } from "@/actions/trades"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { supabaseAdmin } from "@/lib/supabase"

const BUCKET = process.env.SUPABASE_BUCKET_SCREENSHOTS || "screenshots"

export const dynamic = "force-dynamic"

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const trade = await getTradeById(id)

  if (!trade) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Journal entry</h1>
          <Button asChild variant="outline"><Link href="/dashboard/journal">Back</Link></Button>
        </div>
        <div className="rounded-md border p-6 text-muted-foreground">Entry not found.</div>
      </div>
    )
  }

  const fmtNum = (val: unknown): string => {
    if (val === null || val === undefined) return "-"
    const n = Number(val)
    return Number.isFinite(n) ? n.toFixed(2) : String(val)
  }
  const fmtListNum = (arr: unknown[] | null): string =>
    Array.isArray(arr) && arr.length ? arr.map(v => fmtNum(v)).join(", ") : "-"

  // Resolve a fresh signed URL for the screenshot if we stored a path or the previous
  // signed URL expired. We try to parse the key out of an existing signed URL too.
  const resolveSignedUrl = async (val: string | null | undefined): Promise<string | null> => {
    if (!val) return null
    if (!val.startsWith("http")) {
      // Looks like a storage key path; sign it fresh
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(val, 60 * 60)
      return error ? null : data?.signedUrl ?? null
    }
    try {
      const url = new URL(val)
      const idx = url.pathname.indexOf(`/object/sign/`)
      if (idx >= 0) {
        const parts = url.pathname.split("/object/sign/")[1]?.split("/") ?? []
        const bucket = parts.shift() || BUCKET
        const key = parts.join("/")
        if (key) {
          const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(key, 60 * 60)
          return error ? val : data?.signedUrl ?? val
        }
      }
    } catch {}
    return val
  }

  const screenshot = await resolveSignedUrl(trade.screenshotUrl ?? null)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{trade.symbol} • {trade.position?.toUpperCase() ?? "-"}</h1>
          <p className="text-muted-foreground text-sm">{new Date(trade.createdAt).toLocaleString()}</p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/journal">Back</Link></Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-md border p-4">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Overview</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Timeframe</div>
                <div>{trade.timeframe ?? "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Direction</div>
                <div>{trade.tradeDirection ?? "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Entry price(s)</div>
                <div>{fmtListNum(trade.entryPrices as unknown as unknown[])}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Stop loss</div>
                <div>{fmtNum(trade.stopLoss)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Take profit</div>
                <div>{fmtListNum(trade.takeProfit as unknown as unknown[])}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Position size(s)</div>
                <div>{fmtListNum(trade.positionSizes as unknown as unknown[])}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total size</div>
                <div>{fmtNum(trade.totalPositionSize)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">P/L</div>
                <div>{fmtNum(trade.profitLoss)} {trade.pips != null ? `(${trade.pips} pips)` : ""}</div>
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Additional notes</div>
              <div className="text-sm whitespace-pre-wrap">{trade.additionalNotes ?? "-"}</div>
            </div>
            <Separator />
            <div>
              <div className="text-muted-foreground text-xs mb-1">Observation</div>
              <div className="text-sm whitespace-pre-wrap">{trade.observation ?? "-"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-md border p-2">
          {screenshot ? (
            <a href={screenshot} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt="Trade screenshot" className="max-h-[70vh] w-full object-contain bg-muted" />
            </a>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm">No screenshot</div>
          )}
        </div>
      </div>
    </div>
  )
}
