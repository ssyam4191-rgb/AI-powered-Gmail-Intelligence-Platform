/**
 * POST /api/send — Send email via Gmail API
 * Body: { to, subject, body, inReplyTo?, references?, threadId? }
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { createGmailClient, sendEmail } from "@/lib/gmail"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.userId || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { to, subject, body, inReplyTo, references, threadId } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: user } = await supabase
    .from("users")
    .select("gmail_access_token, gmail_refresh_token")
    .eq("id", session.userId)
    .single()

  if (!user?.gmail_access_token) {
    return NextResponse.json({ error: "No Gmail token" }, { status: 400 })
  }

  const gmail = createGmailClient(
    user.gmail_access_token,
    user.gmail_refresh_token || undefined
  )

  const messageId = await sendEmail(gmail, {
    to,
    subject,
    body,
    inReplyTo,
    references,
    threadId,
  })

  return NextResponse.json({ messageId, success: true })
}
