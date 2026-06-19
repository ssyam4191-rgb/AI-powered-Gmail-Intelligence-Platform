"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Reply, User, Clock, Tag, Loader2, Brain
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { toast } from "sonner"
import CategoryBadge from "@/components/CategoryBadge"
import ReplyModal from "@/components/ReplyModal"

interface Email {
  id: string
  gmail_message_id: string
  from_email: string
  from_name: string | null
  to_emails: string[]
  subject: string | null
  body_text: string | null
  body_html: string | null
  snippet: string | null
  summary: string | null
  category: string
  sent_at: string | null
  in_reply_to: string | null
  references: string | null
  is_read: boolean
}

interface Thread {
  id: string
  gmail_thread_id: string
  subject: string | null
  summary: string | null
  category: string
  participants: string[]
  message_count: number
}

export default function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [replyOpen, setReplyOpen] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/threads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setThread(data.thread)
        setMessages(data.messages || [])
        // Auto-expand the latest message
        if (data.messages?.length > 0) {
          setExpandedMessages(
            new Set([data.messages[data.messages.length - 1].id])
          )
        }
      })
      .catch(() => toast.error("Failed to load thread"))
      .finally(() => setLoading(false))

    // Mark all emails in this thread as read
    fetch(`/api/threads/${id}`, { method: "PATCH" }).catch(() => {
      // silently ignore — non-critical
    })
  }, [id])

  const toggleExpand = (msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">
              {thread?.subject || "(No Subject)"}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{thread?.message_count} messages</span>
              <span>·</span>
              <span>{thread?.participants?.length} participants</span>
              {thread && <CategoryBadge category={thread.category} />}
            </div>
          </div>
          <button
            id="reply-btn"
            onClick={() => setReplyOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* Thread AI Summary */}
        {thread?.summary && (
          <div className="glass rounded-xl p-4 border border-indigo-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                AI Thread Summary
              </span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{thread.summary}</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          const isExpanded = expandedMessages.has(msg.id)
          const isLatest = idx === messages.length - 1

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className="glass rounded-xl border border-white/5 overflow-hidden"
            >
              {/* Message header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleExpand(msg.id)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-semibold">
                    {(msg.from_name || msg.from_email)[0].toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">
                      {msg.from_name || msg.from_email}
                    </span>
                    {!isExpanded && msg.summary && (
                      <span className="text-xs text-indigo-400/70 truncate hidden sm:block">
                        — {msg.summary}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>To: {msg.to_emails.slice(0, 2).join(", ")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs text-gray-500">
                    {msg.sent_at
                      ? format(new Date(msg.sent_at), "MMM d, h:mm a")
                      : ""}
                  </span>
                </div>
              </div>

              {/* AI per-email summary */}
              {isExpanded && msg.summary && (
                <div className="mx-4 mb-3 px-3 py-2 bg-indigo-950/40 rounded-lg border border-indigo-500/15">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="w-3 h-3 text-indigo-400" />
                    <span className="text-xs text-indigo-400 font-medium">
                      AI Summary
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {msg.summary}
                  </p>
                </div>
              )}

              {/* Message body */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="prose prose-sm prose-invert max-w-none">
                    {msg.body_text ? (
                      <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans leading-relaxed bg-gray-900/50 rounded-lg p-4">
                        {msg.body_text.slice(0, 5000)}
                        {msg.body_text.length > 5000 && (
                          <span className="text-gray-600">
                            {"\n\n[Message truncated — too long to display]"}
                          </span>
                        )}
                      </pre>
                    ) : (
                      <p className="text-gray-500 text-sm italic">
                        {msg.snippet || "No content available"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {thread && (
        <ReplyModal
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          threadId={id}
          threadSubject={thread.subject}
        />
      )}
    </div>
  )
}
