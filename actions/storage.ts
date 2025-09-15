"use server"

import { supabaseAdmin } from "@/lib/supabase"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

const BUCKET = process.env.SUPABASE_BUCKET_SCREENSHOTS || "screenshots"

export async function uploadScreenshot(formData: FormData) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const file = formData.get("file") as File | null
  if (!file) {
    throw new Error("No file uploaded")
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, file, {
      contentType: file.type || "image/png",
      upsert: false
    })

  if (uploadError) {
    console.error("Supabase upload error:", uploadError)
    throw new Error("Upload failed")
  }

  const { data: signed, error: signedErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60) // 1 hour

  if (signedErr || !signed) {
    console.error("Supabase signed URL error:", signedErr)
    throw new Error("Failed to create signed URL")
  }

  const params = new URLSearchParams({ screenshot: signed.signedUrl })
  redirect(`/dashboard/journal?${params.toString()}`)
}
