import { createAdminClient } from "@/lib/supabase/server"
import { generateQueryEmbedding } from "@/lib/gemini"

export interface RetrievedEmail {
  id: string
  user_id: string
  thread_id: string
  gmail_message_id: string
  gmail_thread_id: string
  from_email: string
  from_name: string | null
  subject: string | null
  body_text: string | null
  snippet: string | null
  summary: string | null
  category: string
  sent_at: string | null
  similarity: number
}


export async function retrieveRelevantEmails(
  query: string,
  userId: string,
  options: {
    limit?: number
    minSimilarity?: number
    category?: string
  } = {}
): Promise<RetrievedEmail[]> {
  const { limit = 10, minSimilarity = 0.3 } = options
  const supabase = createAdminClient()

  // 1. Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query)

  // 2. Vector similarity search via RPC
  const { data, error } = await supabase.rpc("match_emails", {
    query_embedding: queryEmbedding,
    match_count: limit * 2, // Fetch more, then filter
    filter_user_id: userId,
  })

  if (error) {
    console.error("RAG retrieval error:", error)
    return []
  }

  // 3. Filter by minimum similarity and return top results
  const filtered = (data || [])
    .filter((e: RetrievedEmail) => e.similarity >= minSimilarity)
    .slice(0, limit)

  return filtered
}

export async function hybridSearchEmails(
  query: string,
  userId: string,
  limit = 10
): Promise<RetrievedEmail[]> {
  const supabase = createAdminClient()

  // Run vector search and keyword search in parallel
  const [vectorResults, keywordResults] = await Promise.allSettled([
    retrieveRelevantEmails(query, userId, { limit }),
    supabase
      .from("emails")
      .select(
        "id, user_id, thread_id, gmail_message_id, gmail_thread_id, from_email, from_name, subject, body_text, snippet, summary, category, sent_at"
      )
      .eq("user_id", userId)
      .textSearch("body_text", query, { type: "websearch" })
      .limit(limit),
  ])

  const vectorEmails =
    vectorResults.status === "fulfilled" ? vectorResults.value : []

  const keywordEmails =
    keywordResults.status === "fulfilled" && !keywordResults.value.error
      ? (keywordResults.value.data || []).map((e: any) => ({
        ...e,
        similarity: 0.5, // Default similarity for keyword matches
      }))
      : []

  // Merge and deduplicate by gmail_message_id, prioritizing vector results
  const seen = new Set<string>()
  const merged: RetrievedEmail[] = []

  for (const email of [...vectorEmails, ...keywordEmails]) {
    if (!seen.has(email.gmail_message_id)) {
      seen.add(email.gmail_message_id)
      merged.push(email)
    }
  }

  return merged.slice(0, limit)
}
