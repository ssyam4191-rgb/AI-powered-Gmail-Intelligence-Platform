"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface SyncJob {
  id: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  total_emails: number
  synced_emails: number
  error: string | null
}

export default function SyncPage() {
  const router = useRouter()
  const [job, setJob] = useState<SyncJob | null>(null)
  const [syncing, setSyncing] = useState(false)

  const startSync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      const data = await res.json()
      if (data.jobId) {
        setJob({ ...data, progress: 0, total_emails: 0, synced_emails: 0 })
        pollStatus(data.jobId)
      }
    } catch {
      toast.error("Failed to start sync")
      setSyncing(false)
    }
  }, [])

  const pollStatus = useCallback(async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/gmail/sync/status?jobId=${jobId}`)
        const data: SyncJob = await res.json()
        setJob(data)

        if (data.status === "completed") {
          clearInterval(interval)
          setSyncing(false)
          toast.success("Sync complete! Loading your inbox...")
          setTimeout(() => router.push("/inbox"), 1500)
        } else if (data.status === "failed") {
          clearInterval(interval)
          setSyncing(false)
          toast.error(data.error || "Sync failed")
        }
      } catch {
        clearInterval(interval)
        setSyncing(false)
      }
    }, 2000)
  }, [router])

  // Auto-start sync on mount
  useEffect(() => {
    startSync()
  }, [startSync])

  const progressPercent = job?.progress || 0

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass rounded-2xl p-8 text-center">
          {/* Status icon */}
          <div className="flex justify-center mb-6">
            {!job || job.status === "pending" || job.status === "running" ? (
              <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              </div>
            ) : job.status === "completed" ? (
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {!job || job.status === "running"
              ? "Syncing your emails"
              : job.status === "completed"
              ? "Sync complete!"
              : job.status === "pending"
              ? "Starting sync..."
              : "Sync failed"}
          </h1>

          <p className="text-gray-400 text-sm mb-8">
            {job?.status === "running"
              ? `Processing ${job.synced_emails} of ${job.total_emails} emails — summarizing, categorizing, and building your AI knowledge base...`
              : job?.status === "completed"
              ? "Your emails are ready. Redirecting to inbox..."
              : job?.status === "failed"
              ? job.error
              : "Connecting to Gmail and fetching your emails..."}
          </p>

          {/* Progress bar */}
          {(job?.status === "running" || job?.status === "pending") && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{progressPercent}%</span>
                <span>
                  {job?.synced_emails || 0} / {job?.total_emails || "?"} emails
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* What's happening */}
          {job?.status === "running" && (
            <div className="space-y-2 text-left mb-6">
              {[
                { step: "Fetching emails from Gmail", done: true },
                { step: "Categorizing with NVIDIA NIM AI", done: (job.progress || 0) > 20 },
                { step: "Generating summaries with Gemini", done: (job.progress || 0) > 40 },
                { step: "Building semantic search index", done: (job.progress || 0) > 70 },
                { step: "Preparing your inbox", done: (job.progress || 0) >= 90 },
              ].map(({ step, done }) => (
                <div key={step} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-600 shrink-0" />
                  )}
                  <span className={done ? "text-gray-300" : "text-gray-500"}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {job?.status === "failed" && (
            <button
              onClick={startSync}
              disabled={syncing}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Sync
            </button>
          )}

          {!syncing && !job && (
            <button
              onClick={startSync}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              Start Sync
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
