"use client"

import { useState } from "react"
import { X, Sparkles, Send, Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"

interface ReplyModalProps {
  open: boolean
  onClose: () => void
  threadId: string
  threadSubject: string | null
}

interface ReplyDraft {
  to: string
  subject: string
  body: string
  inReplyTo: string
  references: string
  gmailThreadId: string
}

export default function ReplyModal({ open, onClose, threadId, threadSubject }: ReplyModalProps) {
  const [step, setStep] = useState<"prompt" | "draft">("prompt")
  const [prompt, setPrompt] = useState("")
  const [draft, setDraft] = useState<ReplyDraft | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  if (!open) return null

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, prompt }),
      })
      if (!res.ok) {
        throw new Error("Failed to generate draft")
      }
      const data = await res.json()
      setDraft(data)
      setStep("draft")
    } catch {
      toast.error("Failed to generate reply")
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!draft) return
    setSending(true)
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          inReplyTo: draft.inReplyTo,
          references: draft.references,
          threadId: draft.gmailThreadId,
        }),
      })
      if (!res.ok) {
        throw new Error("Failed to send email")
      }
      toast.success("Reply sent!")
      handleClose()
    } catch {
      toast.error("Failed to send reply")
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">
              {step === "prompt" ? "AI Reply Setup" : "Review & Send Reply"}
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
        <div className="p-6">
          {step === "prompt" ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">Subject: </span>
                {threadSubject || "(No Subject)"}
              </div>
              <p className="text-sm text-gray-400">
                What do you want to say in reply? Explain in simple terms, and AI will structure a contextual reply.
              </p>
              <textarea
                id="reply-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g. "Politely decline the invitation, stating that I have a conflict on Thursday morning, but offer Thursday afternoon instead."'
                rows={4}
                className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none outline-none focus:border-indigo-500/50 transition-colors"
                autoFocus
              />
              <div className="flex justify-end">
                <button
                  id="generate-reply-btn"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? "Drafting..." : "Draft Reply"}
                </button>
              </div>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">To</label>
                    <input
                      id="reply-to"
                      value={draft.to}
                      onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                      className="w-full mt-1 bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-gray-200 text-sm outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</label>
                    <input
                      id="reply-subject"
                      value={draft.subject}
                      disabled
                      className="w-full mt-1 bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-gray-400 text-sm outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Message</label>
                  <textarea
                    id="reply-body"
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
                    id="send-reply-btn"
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sending ? "Sending..." : "Send Reply"}
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
