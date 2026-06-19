/**
 * GET  /api/threads/[id] — Full thread with all messages
 * PATCH /api/threads/[id] — Mark all emails in thread as read
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  const { data: thread, error: threadError } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single()

  if (threadError || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  const { data: messages, error: messagesError } = await supabase
    .from("emails")
    .select("*")
    .eq("thread_id", id)
    .eq("user_id", session.userId)
    .order("sent_at", { ascending: true })

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 })
  }

  return NextResponse.json({ thread, messages })
}

/**
 * PATCH /api/threads/[id] — Mark all emails in a thread as read
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("emails")
    .update({ is_read: true })
    .eq("thread_id", id)
    .eq("user_id", session.userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
