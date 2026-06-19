"use client"

import { useState } from "react"
import { X, Sparkles, Send, Loader2, Edit3 } from "lucide-react"
import { toast } from "sonner"

interface ComposeModalProps {
  open: boolean
  onClose: () => void
}

export default function ComposeModal({ open, onClose }: ComposeModalProps) {
  const [step, setStep] = useState<"prompt" | "draft">("prompt")
  const [prompt, setPrompt] = useState("")
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  if (!open) return null

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setDraft(data)
      setStep("draft")
    } catch {
      toast.error("Failed to generate email")
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!draft) return
    setSending(true)
    try {
      await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      toast.success("Email sent!")
      handleClose()
    } catch {
      toast.error("Failed to send email")
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setStep("prompt")
    setPrompt("")
    setDraft(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl glass rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">
              {step === "prompt" ? "AI Compose" : "Review & Send"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {step === "prompt" ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Describe the email you want to write, and AI will draft it for you.
              </p>
              <textarea
                id="compose-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
                placeholder='e.g. "Write a follow-up to the product team about the Q3 launch delay"'
                rows={4}
                className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none outline-none focus:border-indigo-500/50 transition-colors"
                autoFocus
              />
              <div className="flex justify-end">
                <button
                  id="generate-email-btn"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? "Generating..." : "Generate Draft"}
                </button>
              </div>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">To</label>
                  <input
                    id="compose-to"
                    value={draft.to}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                    className="w-full mt-1 bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-gray-200 text-sm outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</label>
                  <input
                    id="compose-subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    className="w-full mt-1 bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-gray-200 text-sm outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Body</label>
                  <textarea
                    id="compose-body"
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    rows={10}
                    className="w-full mt-1 bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 text-sm resize-none outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => { setStep("prompt"); setDraft(null) }}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-white/5 transition-colors"
                >
                  ← Regenerate
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-white/5 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    id="send-email-btn"
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
