"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Send, Brain, ArrowLeft, Plus, Loader2, ExternalLink,
  MessageSquare, AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
}

interface Source {
  email_id: string
  gmail_message_id: string
  subject: string | null
  from_email: string
  from_name: string | null
  sent_at: string | null
  snippet: string | null
  similarity?: number
}

interface ChatSession {
  id: string
  title: string
  created_at: string
}

const EXAMPLE_QUERIES = [
  "Summarize all emails from last week",
  "Which companies rejected my job applications?",
  "What has been discussed about the project deadline?",
  "List all important news from newsletters this week",
  "Show me all financial transactions in my emails",
]

export default function ChatPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/chat")
    const data = await res.json()
    setSessions(data.sessions || [])
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    setInput("")
    setLoading(true)

    // Optimistic update
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession,
          message: messageText,
          history,
        }),
      })

      const data = await res.json()

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Update conversation history for multi-turn context
      setHistory((prev) => [
        ...prev,
        { role: "user", content: messageText },
        { role: "assistant", content: data.answer },
      ])

      if (!activeSession && data.sessionId) {
        setActiveSession(data.sessionId)
        loadSessions()
      }
    } catch {
      toast.error("Failed to get response")
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const startNewChat = () => {
    setActiveSession(null)
    setMessages([])
    setHistory([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sessions sidebar */}
      <aside className="w-64 flex-shrink-0 glass border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => router.push("/inbox")}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-white text-sm">AI Chat Agent</span>
            </div>
          </div>
          <button
            id="new-chat-btn"
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-2 mb-2">
            History
          </div>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSession(s.id)
                // Could load session messages here
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                activeSession === s.id
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{s.title}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 glass">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm">Gmail Intelligence Agent</h1>
              <p className="text-xs text-gray-500">Ask anything about your emails</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Your AI Email Assistant
                </h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  I've read all your emails and can answer questions, find information, and synthesize insights across your entire inbox.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left px-4 py-3 rounded-xl glass border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-600/10 text-gray-400 hover:text-gray-200 text-sm transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-appear flex gap-4 max-w-4xl mx-auto w-full ${
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold ${
                  msg.role === "user"
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                }`}
              >
                {msg.role === "user" ? "U" : <Brain className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div className={`flex-1 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                <div
                  className={`rounded-2xl px-5 py-4 ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white max-w-xl"
                      : "glass border border-white/5 text-gray-200"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                        Sources from your emails
                      </p>
                      <div className="space-y-2">
                        {msg.sources.map((src) => (
                          <div
                            key={src.email_id}
                            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-indigo-950/40 border border-indigo-500/15"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-indigo-300 truncate">
                                {src.subject || "(No Subject)"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {src.from_name || src.from_email}
                                {src.sent_at &&
                                  ` · ${format(new Date(src.sent_at), "MMM d, yyyy")}`}
                              </p>
                            </div>
                            {src.similarity && (
                              <span className="text-xs text-gray-600 shrink-0">
                                {Math.round(src.similarity * 100)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-appear flex gap-4 max-w-4xl mx-auto w-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="glass border border-white/5 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Searching your emails and reasoning...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/5 glass">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 glass rounded-2xl border border-white/10 px-4 py-3">
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your emails... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 bg-transparent text-gray-200 placeholder-gray-600 text-sm resize-none outline-none leading-relaxed max-h-32"
                style={{ minHeight: "24px" }}
              />
              <button
                id="send-chat-btn"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-700 text-center mt-2">
              Answers are grounded exclusively in your emails. Sources are always cited.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
