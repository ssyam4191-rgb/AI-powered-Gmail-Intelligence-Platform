/**
 * Google Gemini AI client
 * Handles: email summarization, compose, reply, chat agent, embeddings
 */
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai"
import type { EmailCategory } from "@/types/database"
import { nimCompletion } from "./nvidia"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" })

// ============================================================
// Embeddings
// ============================================================
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    outputDimensionality: 768,
  } as any)
  return result.embedding.values
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { role: "user", parts: [{ text }] },
    taskType: TaskType.RETRIEVAL_QUERY,
    outputDimensionality: 768,
  } as any)
  return result.embedding.values
}

// ============================================================
// Email Summarization
// ============================================================
export async function summarizeEmail(email: {
  subject: string
  from: string
  body: string
  sentAt?: string
}): Promise<string> {
  const prompt = `Summarize this email in 2-3 concise sentences. Focus on the key message, action items, and important information.

From: ${email.from}
Subject: ${email.subject}
Date: ${email.sentAt || "Unknown"}

${email.body.slice(0, 4000)}

Summary:`

  try {
    const result = await flashModel.generateContent(prompt)
    return result.response.text().trim()
  } catch (error) {
    console.warn("Gemini summarizeEmail failed, falling back to NVIDIA NIM:", error)
    return nimCompletion([{ role: "user", content: prompt }], 200, 0.3)
  }
}

export async function summarizeThread(messages: Array<{
  from: string
  subject: string
  body: string
  sentAt?: string
}>): Promise<string> {
  // For long threads, use sliding window chunking
  const MAX_CHARS_PER_MSG = 2000
  const messagesText = messages
    .map(
      (m, i) =>
        `--- Message ${i + 1} from ${m.from} (${m.sentAt || "unknown date"}) ---\n${m.body.slice(0, MAX_CHARS_PER_MSG)}`
    )
    .join("\n\n")

  const prompt = `You are analyzing an email thread. Summarize the entire conversation in 3-5 sentences covering:
1. What the thread is about
2. Key decisions or conclusions reached
3. Any outstanding action items or next steps

Subject: ${messages[0]?.subject || "Unknown"}

THREAD MESSAGES:
${messagesText.slice(0, 12000)}

Thread Summary:`

  try {
    const result = await flashModel.generateContent(prompt)
    return result.response.text().trim()
  } catch (error) {
    console.warn("Gemini summarizeThread failed, falling back to NVIDIA NIM:", error)
    return nimCompletion([{ role: "user", content: prompt }], 400, 0.3)
  }
}

// ============================================================
// Compose New Email
// ============================================================
export async function composeEmail(prompt: string): Promise<{
  subject: string
  body: string
  to: string
}> {
  const systemPrompt = `You are a professional email composer. Generate a complete, professional email based on the user's prompt.
Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "to": "recipient@example.com",
  "subject": "Email subject here",
  "body": "Full email body here"
}

If the user doesn't specify a recipient, use "recipient@example.com" as a placeholder.
Write in a professional, clear tone. Include proper greeting and sign-off.`

  let text: string
  try {
    const result = await flashModel.generateContent(
      systemPrompt + "\n\nUser prompt: " + prompt
    )
    text = result.response.text().trim()
  } catch (error) {
    console.warn("Gemini composeEmail failed, falling back to NVIDIA NIM:", error)
    text = await nimCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: `User prompt: ${prompt}` }
    ], 600, 0.7)
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Failed to parse compose response")

  return JSON.parse(jsonMatch[0])
}

// ============================================================
// Reply to Email Thread
// ============================================================
export async function generateReply(params: {
  threadMessages: Array<{ from: string; body: string; sentAt?: string }>
  latestSubject: string
  replyPrompt: string
  recipientEmail: string
}): Promise<string> {
  const threadContext = params.threadMessages
    .map(
      (m, i) =>
        `[${i + 1}] From: ${m.from} (${m.sentAt || "unknown"}):\n${m.body.slice(0, 2000)}`
    )
    .join("\n\n---\n\n")

  const prompt = `You are helping compose a professional email reply. Study the full thread context below and generate an appropriate reply based on the user's instruction.

THREAD CONTEXT:
Subject: ${params.latestSubject}

${threadContext.slice(0, 10000)}

USER'S INSTRUCTION FOR REPLY:
"${params.replyPrompt}"

RECIPIENT: ${params.recipientEmail}

Write ONLY the reply body text (no subject line, no metadata). Be professional, context-aware, and address the specific points mentioned.`

  try {
    const result = await flashModel.generateContent(prompt)
    return result.response.text().trim()
  } catch (error) {
    console.warn("Gemini generateReply failed, falling back to NVIDIA NIM:", error)
    return nimCompletion([{ role: "user", content: prompt }], 800, 0.5)
  }
}

// ============================================================
// Chat Agent — RAG-powered Q&A
// ============================================================
export interface ChatSource {
  email_id: string
  gmail_message_id: string
  subject: string | null
  from_email: string
  from_name: string | null
  sent_at: string | null
  snippet: string | null
  similarity?: number
}

export async function chatWithAgent(params: {
  question: string
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  relevantEmails: Array<{
    id: string
    gmail_message_id: string
    from_email: string
    from_name: string | null
    subject: string | null
    body_text: string | null
    snippet: string | null
    sent_at: string | null
    summary: string | null
    similarity: number
  }>
}): Promise<{ answer: string; sources: ChatSource[] }> {
  const { question, conversationHistory, relevantEmails } = params

  if (relevantEmails.length === 0) {
    return {
      answer:
        "I don't have any relevant emails in your inbox related to that question. Could you clarify what you're looking for?",
      sources: [],
    }
  }

  // Build email context for RAG
  const emailContext = relevantEmails
    .map(
      (e, i) =>
        `[EMAIL ${i + 1}]
ID: ${e.gmail_message_id}
From: ${e.from_name ? `${e.from_name} <${e.from_email}>` : e.from_email}
Subject: ${e.subject || "(No Subject)"}
Date: ${e.sent_at ? new Date(e.sent_at).toLocaleDateString() : "Unknown"}
Relevance: ${Math.round((e.similarity || 0) * 100)}%
---
${(e.body_text || e.snippet || e.summary || "No content available").slice(0, 1500)}`
    )
    .join("\n\n")

  const systemPrompt = `You are an AI email assistant. You have access to the user's emails as your ONLY knowledge base.

CRITICAL RULES:
1. Answer ONLY based on the email context provided below. Never make up information.
2. If the information is not in the provided emails, say: "I don't have information about that in your emails."
3. Always cite your sources. When mentioning information, reference which email it came from (e.g., "According to email from John Smith on June 15...").
4. For cross-email synthesis, clearly attribute each piece of information to its source.
5. Be precise and factual — no hallucination allowed.

EMAIL CONTEXT (${relevantEmails.length} most relevant emails):
${emailContext}

Answer the user's question based ONLY on the above emails. Cite sources explicitly.`

  let answer: string
  try {
    // Build conversation for multi-turn context
    // Gemini uses "model" role, not "assistant"
    const history = conversationHistory.slice(-6).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }))

    const chat = flashModel.startChat({
      systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
      history:
        history.length > 1
          ? history.slice(0, -1).map((h) => ({
            role: h.role,
            parts: h.parts,
          }))
          : [],
    })

    const result = await chat.sendMessage(question)
    answer = result.response.text().trim()
  } catch (error) {
    console.warn("Gemini chatWithAgent failed, falling back to NVIDIA NIM:", error)
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-6).map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
      { role: "user", content: question },
    ]
    answer = await nimCompletion(messages, 800, 0.7)
  }

  // Extract sources (emails actually referenced in the answer)
  const sources: ChatSource[] = relevantEmails
    .filter(
      (e) =>
        answer.includes(e.from_email) ||
        answer.includes(e.from_name || "") ||
        answer.includes(e.subject || "") ||
        (e.similarity || 0) > 0.75
    )
    .slice(0, 5)
    .map((e) => ({
      email_id: e.id,
      gmail_message_id: e.gmail_message_id,
      subject: e.subject,
      from_email: e.from_email,
      from_name: e.from_name,
      sent_at: e.sent_at,
      snippet: e.snippet,
      similarity: e.similarity,
    }))

  return { answer, sources }
}

// ============================================================
// Newsletter Deduplication (Bonus Feature)
// ============================================================
export async function extractNewsItems(
  newsletterBody: string,
  source: string
): Promise<Array<{ title: string; summary: string; source: string }>> {
  const prompt = `Extract all news items/stories from this newsletter email. Return ONLY valid JSON array.
Each item should have: title (string), summary (1-2 sentences, string).
Source newsletter: ${source}

Newsletter content:
${newsletterBody.slice(0, 5000)}

JSON array of news items:`

  let text: string
  try {
    const result = await flashModel.generateContent(prompt)
    text = result.response.text().trim()
  } catch (error) {
    console.warn("Gemini extractNewsItems failed, falling back to NVIDIA NIM:", error)
    text = await nimCompletion([{ role: "user", content: prompt }], 1000, 0.2)
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
    const items = JSON.parse(jsonMatch[0])
    return items.map((item: any) => ({ ...item, source }))
  } catch {
    return []
  }
}
