"use client"

import { useFormStatus } from "react-dom"
import { useMemo, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  screenshotUrl?: string | null
}

export default function ScreenshotUploadRow({ screenshotUrl }: Props) {
  const { pending } = useFormStatus()
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const preview = useMemo(() => localPreview || screenshotUrl || null, [localPreview, screenshotUrl])

  const handleFiles = useCallback((files: FileList | null, form?: HTMLFormElement | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    // Basic validation
    const maxMB = 25
    if (file.size > maxMB * 1024 * 1024) {
      setError(`File too large. Max ${maxMB}MB`)
      return
    }
    if (!file.type.startsWith("image/")) {
      setError("Unsupported type. Please upload an image.")
      return
    }
    setError(null)
    setFileName(file.name)
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    // auto-submit the form
    form?.requestSubmit()
  }, [])

  const clearSelection = () => {
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(null)
    setFileName("")
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        "relative rounded-md border border-dashed p-6 md:p-8 cursor-pointer hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent",
        dragOver ? "bg-accent/30 border-accent" : "bg-background",
      ].join(" ")}
      onClick={e => {
        if (pending || dragOver || modalOpen) return
        // If the click originated from a <label htmlFor="screenshot-file">,
        // let the label trigger the input and avoid double opening.
        const target = e.target as HTMLElement
        if (target.closest('label[for="screenshot-file"]')) return
        inputRef.current?.click()
      }}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (!pending && !dragOver && !modalOpen) inputRef.current?.click()
        }
      }}
      onDragOver={e => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files, (e.target as HTMLElement).closest("form") as HTMLFormElement | null)
      }}
    >
      {/* Hidden input for native picker */}
      <input
        id="screenshot-file"
        type="file"
        name="file"
        accept="image/*"
        className="sr-only"
        ref={inputRef}
        onChange={e => handleFiles(e.currentTarget.files, e.currentTarget.form)}
        required
      />

      <div className="flex flex-col items-center justify-center gap-3 text-center">
        {/* Filename above preview */}
        {fileName && (
          <div className="text-xs text-muted-foreground" title={fileName}>
            Selected: {fileName}
          </div>
        )}

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Screenshot preview"
              className="max-h-[160px] w-full max-w-[360px] rounded border object-contain bg-muted cursor-pointer"
              onClick={() => setModalOpen(true)}
            />
            {/* Clear (X) shown only for a local selection prior to upload */}
            {localPreview && !pending && (
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-foreground shadow hover:bg-accent"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <label
            htmlFor="screenshot-file"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-muted cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 5 17 10"/>
              <line x1="12" y1="5" x2="12" y2="19"/>
            </svg>
          </label>
        )}

        <div className="text-sm">
          Drag and drop file here or
          {" "}
          <label
            htmlFor="screenshot-file"
            className="underline underline-offset-2 hover:text-foreground cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            Choose file
          </label>
        </div>
        <div className="text-muted-foreground text-xs">Supported formats: PNG, JPG • Maximum size: 25MB</div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            onClick={e => {
              const hasFile = !!inputRef.current?.files && inputRef.current.files.length > 0
              if (!hasFile) {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Uploading...
              </span>
            ) : (
              "Upload"
            )}
          </Button>
          {preview && !pending && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              className="text-sm"
            >
              Replace
            </Button>
          )}
        </div>
        {!pending && screenshotUrl && <div className="text-xs text-green-600">Uploaded ✓</div>}
      </div>

      {/* Simple modal for larger preview */}
      {modalOpen && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="relative max-h-[90vh] w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <img src={preview} alt="Preview" className="max-h-[90vh] w-full rounded-md object-contain" />
            <div className="absolute right-2 top-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>Replace</Button>
              <Button size="sm" variant="secondary" onClick={() => setModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
