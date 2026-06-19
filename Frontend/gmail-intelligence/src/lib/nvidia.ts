/**
 * NVIDIA NIM API client
 * Used for: Email categorization (llama-3.1-8b-instruct via OpenAI-compatible API)
 * 
 * Why NIM for categorization:
 * - Simple classification task doesn't need Gemini's complexity
 * - Free tier with high throughput — perfect for batch processing during sync
 * - OpenAI-compatible API makes it trivial to integrate
 */
import type { EmailCategory } from "@/types/database"

const NIM_BASE_URL =
  process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"
const NIM_MODEL =
  process.env.NVIDIA_NIM_MODEL || "meta/llama-3.1-8b-instruct"

const CATEGORIES: EmailCategory[] = [
  "Newsletter",
  "Job/Recruitment",
  "Finance",
  "Notifications",
  "Personal",
  "Work/Professional",
  "Uncategorized",
]

// ============================================================
// Core NIM API call
// ============================================================
export async function nimCompletion(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 50,
  temperature = 0.1
): Promise<string> {
  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NVIDIA NIM error ${response.status}: ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ""
}

// ============================================================
// Categorize a single email
// ============================================================
export async function categorizeEmail(email: {
  subject: string
  from: string
  snippet: string
  body?: string
}): Promise<EmailCategory> {
  const content = `Subject: ${email.subject}
From: ${email.from}
Snippet: ${email.snippet}
${email.body ? `Body preview: ${email.body.slice(0, 500)}` : ""}`

  const prompt = `Classify this email into exactly ONE of these categories: Newsletter, Job/Recruitment, Finance, Notifications, Personal, Work/Professional, Uncategorized.

Category definitions:
- Newsletter: Subscription-based content, digests, marketing emails, blog updates
- Job/Recruitment: Job applications, offers, rejections, interview requests, recruiter outreach
- Finance: Invoices, receipts, bank alerts, payment confirmations, financial statements
- Notifications: System alerts, OTPs, platform updates, verification emails
- Personal: Direct human-to-human communication, personal conversations
- Work/Professional: Project discussions, team communication, business emails
- Uncategorized: None of the above

Email to classify:
${content}

Reply with ONLY the category name, nothing else:`

  const response = await nimCompletion([{ role: "user", content: prompt }])

  // Normalize response to valid category
  const normalized = response.trim()
  const matched = CATEGORIES.find(
    (c) => c.toLowerCase() === normalized.toLowerCase()
  )
  return matched || "Uncategorized"
}

// ============================================================
// Batch categorize multiple emails
// ============================================================
export async function categorizeEmailsBatch(
  emails: Array<{
    id: string
    subject: string
    from: string
    snippet: string
    body?: string
  }>,
  concurrency = 5
): Promise<Map<string, EmailCategory>> {
  const results = new Map<string, EmailCategory>()

  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency)
    const categorized = await Promise.allSettled(
      batch.map(async (email) => {
        const category = await categorizeEmail(email)
        return { id: email.id, category }
      })
    )

    for (const result of categorized) {
      if (result.status === "fulfilled") {
        results.set(result.value.id, result.value.category)
      }
    }

    // Small delay between batches to respect rate limits
    if (i + concurrency < emails.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return results
}
