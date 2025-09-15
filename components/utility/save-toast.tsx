"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

export default function SaveToast() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const saved = searchParams.get("saved")
    const error = searchParams.get("error")

    if (saved === "1") {
      toast.success("Trade saved")
      const url = new URL(window.location.href)
      url.searchParams.delete("saved")
      window.history.replaceState({}, "", url.pathname + url.search + url.hash)
    } else if (error) {
      toast.error("Failed to save trade")
      const url = new URL(window.location.href)
      url.searchParams.delete("error")
      window.history.replaceState({}, "", url.pathname + url.search + url.hash)
    }
  }, [searchParams])

  return null
}
