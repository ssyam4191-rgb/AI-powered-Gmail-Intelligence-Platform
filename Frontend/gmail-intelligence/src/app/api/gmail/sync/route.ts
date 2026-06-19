import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import {
  createGmailClient,
  listAllMessageIds,
  fetchMessagesInBatch,
  fetchHistoryChanges,
  parseGmailMessage,
} from "@/lib/gmail"
import { summarizeEmail, summarizeThread, generateEmbedding } from "@/lib/gemini"
import { categorizeEmailsBatch } from "@/lib/nvidia"
import type { EmailCategory } from "@/types/database"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const userId = session.userId

  // Get user's stored tokens
  const { data: user } = await supabase
    .from("users")
    .select("gmail_access_token, gmail_refresh_token, history_id, last_synced_at")
    .eq("id", userId)
    .single()

  if (!user?.gmail_access_token) {
    return NextResponse.json({ error: "No Gmail token" }, { status: 400 })
  }

  // Create or update sync job
  const { data: syncJob } = await supabase
    .from("sync_jobs")
    .insert({
      user_id: userId,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  const jobId = syncJob!.id

  // Run sync in background (don't await — return job ID immediately)
  runSync({
    userId,
    jobId,
    accessToken: user.gmail_access_token,
    refreshToken: user.gmail_refresh_token || undefined,
    historyId: user.history_id || undefined,
    isIncremental: !!user.history_id,
    supabase,
  }).catch(console.error)

  return NextResponse.json({ jobId, status: "running" })
}

async function runSync({
  userId,
  jobId,
  accessToken,
  refreshToken,
  historyId,
  isIncremental,
  supabase,
}: {
  userId: string
  jobId: string
  accessToken: string
  refreshToken?: string
  historyId?: string
  isIncremental: boolean
  supabase: ReturnType<typeof createAdminClient>
}) {
  const gmail = createGmailClient(accessToken, refreshToken)

  const updateJob = async (updates: Record<string, any>) => {
    await supabase.from("sync_jobs").update(updates).eq("id", jobId)
  }

  try {
    let messageIds: string[] = []

    if (isIncremental && historyId) {
      // Incremental sync via History API
      try {
        const { addedMessageIds } = await fetchHistoryChanges(gmail, historyId)
        messageIds = addedMessageIds
      } catch (err: any) {
        if (err.message === "HISTORY_EXPIRED") {
          // Fall back to full sync
          isIncremental = false
        } else {
          throw err
        }
      }
    }

    if (!isIncremental) {
      // Initial full sync — paginate all messages (limit to 500 for assessment)
      let count = 0
      for await (const batch of listAllMessageIds(gmail)) {
        messageIds.push(...batch)
        count += batch.length
        if (count >= 500) break // Limit for demo
      }
    }

    await updateJob({ total_emails: messageIds.length })

    // Process messages in chunks of 50
    const CHUNK_SIZE = 50
    let synced = 0

    for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
      const chunk = messageIds.slice(i, i + CHUNK_SIZE)

      // Fetch full message data
      const messages = await fetchMessagesInBatch(gmail, chunk, 10)

      // Parse and upsert messages
      const parsedEmails = messages.map(parseGmailMessage)

      // Categorize this batch using NVIDIA NIM
      const categorized = await categorizeEmailsBatch(
        parsedEmails.map((e) => ({
          id: e.gmailMessageId,
          subject: e.subject,
          from: `${e.fromName} <${e.fromEmail}>`,
          snippet: e.snippet,
          body: e.bodyText,
        })),
        5
      )

      // Group by thread for thread-level processing
      const threadGroups = new Map<string, typeof parsedEmails>()
      for (const email of parsedEmails) {
        const group = threadGroups.get(email.gmailThreadId) || []
        group.push(email)
        threadGroups.set(email.gmailThreadId, group)
      }

      // Upsert threads and emails
      for (const [gmailThreadId, threadEmails] of threadGroups) {
        const sortedEmails = threadEmails.sort(
          (a, b) =>
            (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0)
        )
        const latest = sortedEmails[sortedEmails.length - 1]
        const participants = [
          ...new Set(
            sortedEmails.flatMap((e) => [e.fromEmail, ...e.toEmails])
          ),
        ]
        const labels = [...new Set(sortedEmails.flatMap((e) => e.labels))]
        const category =
          (categorized.get(latest.gmailMessageId) as EmailCategory) ||
          "Uncategorized"

        // Upsert thread
        const { data: thread } = await supabase
          .from("email_threads")
          .upsert(
            {
              user_id: userId,
              gmail_thread_id: gmailThreadId,
              subject: latest.subject,
              category,
              participants,
              last_message_at: latest.sentAt?.toISOString() || null,
              message_count: sortedEmails.length,
              labels,
            },
            { onConflict: "user_id,gmail_thread_id" }
          )
          .select("id")
          .single()

        if (!thread) continue

        // Upsert individual emails
        for (const email of sortedEmails) {
          const emailCategory =
            categorized.get(email.gmailMessageId) || category

          // Generate per-email summary
          let summary: string | null = null
          try {
            if (email.bodyText || email.snippet) {
              summary = await summarizeEmail({
                subject: email.subject,
                from: `${email.fromName} <${email.fromEmail}>`,
                body: email.bodyText || email.snippet,
                sentAt: email.sentAt?.toISOString(),
              })
            }
          } catch (err) {
            console.warn("Summary failed for", email.gmailMessageId, err)
          }

          // Generate embedding for RAG
          let embedding: number[] | null = null
          try {
            const embeddingText = [
              email.subject,
              email.fromEmail,
              email.fromName,
              email.bodyText?.slice(0, 3000) || email.snippet,
            ]
              .filter(Boolean)
              .join(" ")
            embedding = await generateEmbedding(embeddingText)
          } catch (err) {
            console.warn("Embedding failed for", email.gmailMessageId, err)
          }

          await supabase.from("emails").upsert(
            {
              user_id: userId,
              thread_id: thread.id,
              gmail_message_id: email.gmailMessageId,
              gmail_thread_id: email.gmailThreadId,
              from_email: email.fromEmail,
              from_name: email.fromName || null,
              to_emails: email.toEmails,
              cc_emails: email.ccEmails,
              subject: email.subject,
              body_text: email.bodyText || null,
              body_html: email.bodyHtml || null,
              snippet: email.snippet,
              summary,
              category: emailCategory,
              labels: email.labels,
              in_reply_to: email.inReplyTo || null,
              references: email.references || null,
              sent_at: email.sentAt?.toISOString() || null,
              embedding,
              is_read: email.isRead,
            },
            { onConflict: "gmail_message_id" }
          )
        }

        // Generate thread-level summary and embedding
        try {
          if (sortedEmails.length > 0) {
            const threadSummary = await summarizeThread(
              sortedEmails.map((e) => ({
                from: `${e.fromName} <${e.fromEmail}>`,
                subject: e.subject,
                body: e.bodyText || e.snippet,
                sentAt: e.sentAt?.toISOString(),
              }))
            )

            const threadEmbeddingText = [
              latest.subject,
              participants.join(" "),
              threadSummary,
            ].join(" ")
            const threadEmbedding = await generateEmbedding(threadEmbeddingText)

            await supabase
              .from("email_threads")
              .update({ summary: threadSummary, embedding: threadEmbedding })
              .eq("id", thread.id)
          }
        } catch (err) {
          console.warn("Thread summary failed for", gmailThreadId, err)
        }
      }

      synced += chunk.length
      const progress = Math.round((synced / messageIds.length) * 100)
      await updateJob({ synced_emails: synced, progress })
    }

    // Update user's historyId for incremental sync next time
    const profileRes = await gmail.users.getProfile({ userId: "me" })
    const newHistoryId = profileRes.data.historyId

    await supabase
      .from("users")
      .update({
        history_id: newHistoryId,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", userId)

    await updateJob({
      status: "completed",
      progress: 100,
      completed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error("Sync error:", err)
    await updateJob({
      status: "failed",
      error: err.message || "Unknown error",
      completed_at: new Date().toISOString(),
    })
  }
}
