import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE

if (!url) throw new Error("SUPABASE_URL is not set")
if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE is not set")

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { persistSession: false },
  global: { headers: { "X-Client-Info": "trade-tally" } }
})
