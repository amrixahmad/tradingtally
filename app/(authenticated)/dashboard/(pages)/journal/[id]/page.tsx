import { getTradeById, updateTrade } from "@/actions/trades"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { supabaseAdmin } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const BUCKET = process.env.SUPABASE_BUCKET_SCREENSHOTS || "screenshots"

export const dynamic = "force-dynamic"

export default async function JournalEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const isEdit = sp?.edit === "1"
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

  async function updateTradeAction(formData: FormData) {
    "use server"
    const parseCsvNums = (val: string | null | undefined): number[] | null => {
      if (!val) return null
      const arr = String(val)
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => !Number.isNaN(n))
      if (!arr.length) return null
      return arr.map(n => Math.round(n * 100) / 100)
    }
    const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

    const entryPrices = parseCsvNums(formData.get("entryPrices") as string)
    const stopLoss = formData.get("stopLoss") ? r2(Number(formData.get("stopLoss"))) : null
    const takeProfit = parseCsvNums(formData.get("takeProfit") as string)
    const positionSizes = parseCsvNums(formData.get("positionSizes") as string)
    const totalPositionSize = formData.get("totalPositionSize") ? r2(Number(formData.get("totalPositionSize"))) : null
    const profitLoss = formData.get("profitLoss") ? r2(Number(formData.get("profitLoss"))) : null
    const additionalNotes = (formData.get("additionalNotes")?.toString().trim() || "") || null
    const observation = (formData.get("observation")?.toString().trim() || "") || null

    await updateTrade(id, { entryPrices, stopLoss, takeProfit, positionSizes, totalPositionSize, profitLoss, additionalNotes, observation })
    revalidatePath(`/dashboard/journal/${id}`)
    redirect(`/dashboard/journal/${id}`)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{trade.symbol} • {trade.position?.toUpperCase() ?? "-"}</h1>
          <p className="text-muted-foreground text-sm">{new Date(trade.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          {isEdit ? (
            <Button asChild variant="outline"><Link href={`/dashboard/journal/${id}`}>Cancel</Link></Button>
          ) : (
            <Button asChild variant="outline"><Link href={`/dashboard/journal/${id}?edit=1`}>Edit Trade</Link></Button>
          )}
          <Button asChild variant="outline"><Link href="/dashboard/journal">Back</Link></Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-md border p-4">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Overview</h2>
            {isEdit ? (
              <form action={updateTradeAction} className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground" htmlFor="entryPrices">Entry price(s)</Label>
                  <Input id="entryPrices" name="entryPrices" defaultValue={Array.isArray(trade.entryPrices) && trade.entryPrices.length ? trade.entryPrices.join(", ") : ""} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground" htmlFor="stopLoss">Stop loss</Label>
                  <Input id="stopLoss" name="stopLoss" type="number" step="0.01" defaultValue={trade.stopLoss ?? undefined} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground" htmlFor="takeProfit">Take profit</Label>
                  <Input id="takeProfit" name="takeProfit" defaultValue={Array.isArray(trade.takeProfit) && trade.takeProfit.length ? trade.takeProfit.join(", ") : ""} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground" htmlFor="positionSizes">Position size(s)</Label>
                  <Input id="positionSizes" name="positionSizes" defaultValue={Array.isArray(trade.positionSizes) && trade.positionSizes.length ? trade.positionSizes.join(", ") : ""} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground" htmlFor="totalPositionSize">Total size</Label>
                  <Input id="totalPositionSize" name="totalPositionSize" type="number" step="0.01" defaultValue={trade.totalPositionSize ?? undefined} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground" htmlFor="profitLoss">P/L</Label>
                  <Input id="profitLoss" name="profitLoss" type="number" step="0.01" defaultValue={trade.profitLoss ?? undefined} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground" htmlFor="additionalNotes">Additional notes</Label>
                  <Textarea id="additionalNotes" name="additionalNotes" defaultValue={trade.additionalNotes ?? ""} rows={3} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground" htmlFor="observation">Observation</Label>
                  <Textarea id="observation" name="observation" defaultValue={trade.observation ?? ""} rows={3} />
                </div>
                <div className="col-span-2">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            ) : (
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
            )}
          </div>

          {!isEdit && (
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
          )}
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
