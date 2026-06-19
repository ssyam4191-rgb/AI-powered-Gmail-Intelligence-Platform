import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const category = searchParams.get("category")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const search = searchParams.get("search")
  const threadId = searchParams.get("threadId")

  const supabase = createAdminClient()
  const offset = (page - 1) * limit

  let query = supabase
    .from("email_threads")
    .select(
      `
      id, gmail_thread_id, subject, summary, category, 
      participants, last_message_at, message_count, labels,
      emails!inner(
        id, gmail_message_id, from_email, from_name, 
        snippet, summary, is_read, sent_at, category
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", session.userId)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (category && category !== "All") {
    query = query.eq("category", category)
  }

  if (threadId) {
    query = query.eq("id", threadId)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    threads: data,
    total: count,
    page,
    limit,
    hasMore: offset + limit < (count || 0),
  })
}
