/**
 * POST /api/reply — Generate AI reply draft for a thread
 * Body: { threadId: string, prompt: string }
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { generateReply } from "@/lib/gemini"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { threadId, prompt } = await req.json()
  if (!threadId || !prompt) {
    return NextResponse.json(
      { error: "threadId and prompt are required" },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Fetch the full thread
  const { data: thread } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", threadId)
    .eq("user_id", session.userId)
    .single()

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  const { data: messages } = await supabase
    .from("emails")
    .select("from_email, from_name, body_text, snippet, sent_at, in_reply_to, references, gmail_message_id")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true })

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "No messages in thread" }, { status: 400 })
  }

  const latestMessage = messages[messages.length - 1]

  const replyBody = await generateReply({
    threadMessages: messages.map((m: any) => ({
      from: `${m.from_name || ""} <${m.from_email}>`.trim(),
      body: m.body_text || m.snippet || "",
      sentAt: m.sent_at || undefined,
    })),
    latestSubject: thread.subject || "Re: (No Subject)",
    replyPrompt: prompt,
    recipientEmail: latestMessage.from_email,
  })

  return NextResponse.json({
    body: replyBody,
    subject: thread.subject?.startsWith("Re:")
      ? thread.subject
      : `Re: ${thread.subject || "(No Subject)"}`,
    to: latestMessage.from_email,
    inReplyTo: latestMessage.gmail_message_id,
    references: [
      latestMessage.references,
      latestMessage.gmail_message_id,
    ]
      .filter(Boolean)
      .join(" "),
    gmailThreadId: thread.gmail_thread_id,
  })
}
