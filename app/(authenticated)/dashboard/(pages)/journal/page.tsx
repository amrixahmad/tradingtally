import { listTradesByUser, createTrade } from "@/actions/trades"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export const dynamic = "force-dynamic"

async function createTradeAction(formData: FormData) {
  "use server"

  const symbol = String(formData.get("symbol") || "").trim()
  const direction = String(formData.get("direction") || "").trim() as "long" | "short"
  const entry = Number(formData.get("entry"))
  const stop = Number(formData.get("stop"))
  const sizeRiskPct = Number(formData.get("sizeRiskPct"))
  const targets = String(formData.get("targets") || "").trim()
  const setupTags = String(formData.get("setupTags") || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)
  const thesis = String(formData.get("thesis") || "").trim()
  const pl = formData.get("pl") ? Number(formData.get("pl")) : undefined
  const pips = formData.get("pips") ? Number(formData.get("pips")) : undefined
  const rMultiple = formData.get("rMultiple") ? Number(formData.get("rMultiple")) : undefined
  const screenshots = String(formData.get("screenshots") || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)
  const rule1 = formData.get("rule1") === "on" ? true : undefined
  const rule2 = formData.get("rule2") === "on" ? true : undefined
  const rule3 = formData.get("rule3") === "on" ? true : undefined
  const lesson = String(formData.get("lesson") || "").trim()

  if (!symbol || !direction || Number.isNaN(entry) || Number.isNaN(stop) || Number.isNaN(sizeRiskPct)) {
    throw new Error("Missing required fields: symbol, direction, entry, stop, size %")
  }

  await createTrade({
    symbol,
    direction,
    entry,
    stop,
    sizeRiskPct,
    targets,
    setupTags,
    thesis,
    pl,
    pips,
    rMultiple,
    screenshots,
    rule1,
    rule2,
    rule3,
    lesson
  })
}

export default async function JournalPage() {
  const trades = await listTradesByUser()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-muted-foreground mt-2">Log trades quickly with minimal fields.</p>
      </div>

      <form action={createTradeAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="symbol">Symbol</Label>
          <Input name="symbol" id="symbol" placeholder="EURUSD" required />
        </div>
        <div>
          <Label htmlFor="direction">Direction</Label>
          <select name="direction" id="direction" className="border-input bg-background text-foreground inline-flex h-10 w-full items-center justify-center rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
        <div>
          <Label htmlFor="entry">Entry</Label>
          <Input name="entry" id="entry" type="number" step="0.00001" required />
        </div>
        <div>
          <Label htmlFor="stop">Stop</Label>
          <Input name="stop" id="stop" type="number" step="0.00001" required />
        </div>
        <div>
          <Label htmlFor="sizeRiskPct">Size (% risk)</Label>
          <Input name="sizeRiskPct" id="sizeRiskPct" type="number" step="0.01" required />
        </div>
        <div>
          <Label htmlFor="targets">Targets (comma separated)</Label>
          <Input name="targets" id="targets" placeholder="1.1050, 1.1100" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="setupTags">Setup tag(s)</Label>
          <Input name="setupTags" id="setupTags" placeholder="pullback, ny-open" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="thesis">Brief thesis</Label>
          <Textarea name="thesis" id="thesis" placeholder="Why this trade? Key context & invalidation." rows={3} />
        </div>

        <div>
          <Label htmlFor="pl">P/L</Label>
          <Input name="pl" id="pl" type="number" step="0.01" />
        </div>
        <div>
          <Label htmlFor="pips">Pips</Label>
          <Input name="pips" id="pips" type="number" step="1" />
        </div>
        <div>
          <Label htmlFor="rMultiple">R</Label>
          <Input name="rMultiple" id="rMultiple" type="number" step="0.01" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="screenshots">Screenshots (URLs, comma separated)</Label>
          <Input name="screenshots" id="screenshots" placeholder="https://... , https://..." />
        </div>

        <div className="flex items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="rule1" /> Rule: Entry matches plan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="rule2" /> Rule: Size within risk limit
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="rule3" /> Rule: Exit per plan
          </label>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="lesson">One lesson</Label>
          <Textarea name="lesson" id="lesson" rows={2} />
        </div>

        <div className="md:col-span-2">
          <Button type="submit">Save Trade</Button>
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Recent trades</h2>
        <div className="divide-border rounded-md border">
          {trades.length === 0 ? (
            <div className="text-muted-foreground p-4 text-sm">No trades yet.</div>
          ) : (
            trades.map(t => (
              <div key={t.id} className="grid grid-cols-2 gap-2 border-b p-4 last:border-b-0 md:grid-cols-6">
                <div className="font-medium">{t.symbol}</div>
                <div className="uppercase text-xs">{t.direction}</div>
                <div className="text-sm">Entry {String(t.entry)}</div>
                <div className="text-sm">Stop {String(t.stop)}</div>
                <div className="text-sm">R {t.rMultiple ?? "-"}</div>
                <div className="text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
