"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Brain, Pencil, RefreshCw, LogOut, Search,
  Inbox, Tag, ChevronRight, Loader2
} from "lucide-react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import CategoryBadge from "@/components/CategoryBadge"
import ComposeModal from "@/components/ComposeModal"

type Category =
  | "All"
  | "Newsletter"
  | "Job/Recruitment"
  | "Finance"
  | "Notifications"
  | "Personal"
  | "Work/Professional"

const CATEGORIES: Category[] = [
  "All", "Personal", "Work/Professional", "Newsletter",
  "Finance", "Job/Recruitment", "Notifications",
]

interface Thread {
  id: string
  gmail_thread_id: string
  subject: string | null
  summary: string | null
  category: string
  participants: string[]
  last_message_at: string | null
  message_count: number
  emails: Array<{
    id: string
    from_email: string
    from_name: string | null
    snippet: string | null
    is_read: boolean
    sent_at: string | null
  }>
}

export default function InboxPage() {
  const router = useRouter()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Category>("All")
  const [syncing, setSyncing] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchThreads = useCallback(
    async (cat: Category = selectedCategory, p = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: p.toString(),
          limit: "25",
          ...(cat !== "All" ? { category: cat } : {}),
        })
        const res = await fetch(`/api/emails?${params}`)
        const data = await res.json()
        if (p === 1) {
          setThreads(data.threads || [])
        } else {
          setThreads((prev) => [...prev, ...(data.threads || [])])
        }
        setHasMore(data.hasMore)
        setTotal(data.total || 0)
      } catch {
        toast.error("Failed to load emails")
      } finally {
        setLoading(false)
      }
    },
    [selectedCategory]
  )

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  const handleCategoryChange = (cat: Category) => {
    setSelectedCategory(cat)
    setPage(1)
    fetchThreads(cat, 1)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch("/api/gmail/sync", { method: "POST" })
      toast.success("Sync started — emails will update shortly")
      setTimeout(() => fetchThreads(), 5000)
    } catch {
      toast.error("Failed to start sync")
    } finally {
      setSyncing(false)
    }
  }

  const getLatestEmail = (thread: Thread) =>
    thread.emails?.[thread.emails.length - 1] || thread.emails?.[0]

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 glass border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Gmail Intelligence</div>
              <div className="text-gray-500 text-xs">AI Email Platform</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <button
            id="compose-btn"
            onClick={() => setComposeOpen(true)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Compose
          </button>
          <button
            id="chat-btn"
            onClick={() => router.push("/chat")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl glass hover:bg-white/5 text-gray-300 font-medium text-sm transition-colors"
          >
            <Brain className="w-4 h-4 text-indigo-400" />
            AI Chat Agent
          </button>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            Categories
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              id={`cat-${cat.replace(/\//g, "-").toLowerCase()}`}
              onClick={() => handleCategoryChange(cat)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                selectedCategory === cat
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              {cat}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            id="sync-btn"
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync emails"}
          </button>
          <button
            id="signout-btn"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 glass flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <Inbox className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-semibold text-white">
              {selectedCategory === "All" ? "Inbox" : selectedCategory}
            </h1>
            <span className="text-gray-500 text-sm">({total} threads)</span>
          </div>
          <button
            onClick={() => fetchThreads()}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading && threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-gray-500">Loading threads...</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
                <Mail className="w-8 h-8 text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-gray-400 font-medium mb-1">No emails found</p>
                <p className="text-gray-600 text-sm">
                  {selectedCategory !== "All"
                    ? `No ${selectedCategory} emails synced`
                    : "Click 'Sync emails' to fetch your Gmail"}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {threads.map((thread) => {
                const latest = getLatestEmail(thread)
                const isUnread = latest && !latest.is_read
                const timeAgo = thread.last_message_at
                  ? formatDistanceToNow(new Date(thread.last_message_at), {
                      addSuffix: true,
                    })
                  : ""

                return (
                  <div
                    key={thread.id}
                    id={`thread-${thread.id}`}
                    className={`thread-item px-6 py-4 cursor-pointer border border-transparent ${
                      isUnread ? "bg-indigo-950/20" : ""
                    }`}
                    onClick={() => router.push(`/thread/${thread.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Unread indicator */}
                      <div className="mt-1.5 shrink-0">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isUnread ? "bg-indigo-400" : "bg-transparent"
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-sm truncate ${
                                isUnread ? "font-semibold text-white" : "text-gray-300"
                              }`}
                            >
                              {latest?.from_name || latest?.from_email || thread.participants[0] || "Unknown"}
                            </span>
                            {thread.message_count > 1 && (
                              <span className="text-xs text-gray-600 shrink-0">
                                ({thread.message_count})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <CategoryBadge category={thread.category} />
                            <span className="text-xs text-gray-600">{timeAgo}</span>
                            <ChevronRight className="w-4 h-4 text-gray-700" />
                          </div>
                        </div>

                        <p
                          className={`text-sm mb-1 truncate ${
                            isUnread ? "text-gray-200" : "text-gray-400"
                          }`}
                        >
                          {thread.subject || "(No Subject)"}
                        </p>

                        {thread.summary ? (
                          <p className="text-xs text-indigo-400/80 truncate">
                            ✦ {thread.summary}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-600 truncate">
                            {latest?.snippet}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <div className="p-4 text-center">
                  <button
                    onClick={() => {
                      const nextPage = page + 1
                      setPage(nextPage)
                      fetchThreads(selectedCategory, nextPage)
                    }}
                    className="px-6 py-2 rounded-lg glass text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  )
}
