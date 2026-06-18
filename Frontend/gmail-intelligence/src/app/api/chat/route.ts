/**
 * POST /api/chat — AI Chat Agent endpoint
 * Body: { sessionId: string, message: string, history?: Array<{role, content}> }
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { chatWithAgent } from "@/lib/gemini"
import { hybridSearchEmails } from "@/lib/rag"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { sessionId, message, history = [] } = await req.json()
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  const supabase = createAdminClient() as any
  const userId = session.userId

  try {
    // Ensure session exists
    let chatSessionId = sessionId
    if (!chatSessionId) {
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: userId,
          title: message.slice(0, 60),
        })
        .select()
        .single()
      chatSessionId = newSession?.id
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      session_id: chatSessionId,
      user_id: userId,
      role: "user",
      content: message,
    })

    // RAG: Retrieve relevant emails using hybrid search
    const relevantEmails = await hybridSearchEmails(message, userId, 10)
    console.log(`[chat] user=${userId} query="${message}" retrievedEmails=${relevantEmails.length}`)

    // Generate AI response
    const { answer, sources } = await chatWithAgent({
      question: message,
      conversationHistory: history,
      relevantEmails,
    })

    // Save assistant message with sources
    await supabase.from("chat_messages").insert({
      session_id: chatSessionId,
      user_id: userId,
      role: "assistant",
      content: answer,
      sources: sources.length > 0 ? sources : null,
    })

    return NextResponse.json({
      answer,
      sources,
      sessionId: chatSessionId,
    })
  } catch (err: any) {
    console.error("[chat] POST error:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    )
  }
}


// GET /api/chat — List chat sessions
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId")
  const supabase = createAdminClient() as any

  if (sessionId) {
    // Get messages for a specific session
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true })

    return NextResponse.json({ messages: data || [] })
  }

  // List all sessions
  const { data } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ sessions: data || [] })
}
