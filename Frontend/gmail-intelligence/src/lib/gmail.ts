import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/server"


export function createOAuth2Client(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return oauth2Client
}

export function createGmailClient(accessToken: string, refreshToken?: string) {
  const auth = createOAuth2Client(accessToken, refreshToken)
  return google.gmail({ version: "v1", auth })
}


const BACKOFF_BASE_MS = 100
const BACKOFF_MAX_MS = 32000
const MAX_RETRIES = 7

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const status = err?.status || err?.code || err?.response?.status
      const isRateLimited = status === 429 || status === 403
      const isServerError = status >= 500 && status < 600

      if ((isRateLimited || isServerError) && attempt < retries) {
        const delay = Math.min(
          BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * 100,
          BACKOFF_MAX_MS
        )
        console.warn(
          `Gmail API rate limited (attempt ${attempt + 1}/${retries}). Retrying in ${delay}ms...`
        )
        await sleep(delay)
        continue
      }
      throw err
    }
  }
  throw new Error("Max retries exceeded")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}


export function parseEmailAddress(raw: string): { email: string; name: string } {
  const trimmed = raw.trim()

  // Format: "Name <email@domain.com>" or <email@domain.com>
  const angleMatch = trimmed.match(/^"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (angleMatch) {
    return {
      name: angleMatch[1].trim(),
      email: angleMatch[2].trim().toLowerCase(),
    }
  }

  // Format: bare email address (contains @)
  if (trimmed.includes("@")) {
    return { name: "", email: trimmed.toLowerCase() }
  }

  // Fallback: raw string is a display name only — not a valid email
  return { name: trimmed, email: "" }
}

export function decodeBase64(encoded: string): string {
  try {
    return Buffer.from(
      encoded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8")
  } catch {
    return ""
  }
}

export function extractBodyFromParts(parts: any[]): { text: string; html: string } {
  let text = ""
  let html = ""

  function traverse(parts: any[]) {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += decodeBase64(part.body.data)
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html += decodeBase64(part.body.data)
      } else if (part.parts) {
        traverse(part.parts)
      }
    }
  }

  traverse(parts)
  return { text, html }
}

export function getHeader(headers: any[], name: string): string {
  return (
    headers.find(
      (h: any) => h.name.toLowerCase() === name.toLowerCase()
    )?.value || ""
  )
}

export interface ParsedEmail {
  gmailMessageId: string
  gmailThreadId: string
  fromEmail: string
  fromName: string
  toEmails: string[]
  ccEmails: string[]
  subject: string
  bodyText: string
  bodyHtml: string
  snippet: string
  inReplyTo: string
  references: string
  sentAt: Date | null
  labels: string[]
  isRead: boolean
}

export function parseGmailMessage(msg: any): ParsedEmail {
  const headers = msg.payload?.headers || []
  const fromRaw = getHeader(headers, "From")
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw)

  const toRaw = getHeader(headers, "To")
  const toEmails = toRaw
    ? toRaw
      .split(",")
      .map((s: string) => parseEmailAddress(s.trim()).email)
      .filter((e: string) => e.includes("@"))  // only keep valid email addresses
    : []

  const ccRaw = getHeader(headers, "Cc")
  const ccEmails = ccRaw
    ? ccRaw
      .split(",")
      .map((s: string) => parseEmailAddress(s.trim()).email)
      .filter((e: string) => e.includes("@"))  // only keep valid email addresses
    : []

  const subject = getHeader(headers, "Subject") || "(No Subject)"
  const inReplyTo = getHeader(headers, "In-Reply-To")
  const references = getHeader(headers, "References")
  const dateHeader = getHeader(headers, "Date")
  const sentAt = dateHeader ? new Date(dateHeader) : null

  let bodyText = ""
  let bodyHtml = ""

  if (msg.payload?.body?.data) {
    if (msg.payload.mimeType === "text/plain") {
      bodyText = decodeBase64(msg.payload.body.data)
    } else if (msg.payload.mimeType === "text/html") {
      bodyHtml = decodeBase64(msg.payload.body.data)
    }
  } else if (msg.payload?.parts) {
    const extracted = extractBodyFromParts(msg.payload.parts)
    bodyText = extracted.text
    bodyHtml = extracted.html
  }

  const labels: string[] = msg.labelIds || []
  const isRead = !labels.includes("UNREAD")

  return {
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId,
    fromEmail,
    fromName,
    toEmails,
    ccEmails,
    subject,
    bodyText,
    bodyHtml,
    snippet: msg.snippet || "",
    inReplyTo,
    references,
    sentAt: sentAt && !isNaN(sentAt.getTime()) ? sentAt : null,
    labels,
    isRead,
  }
}

export async function* listAllMessageIds(
  gmail: any,
  maxResults = 500
): AsyncGenerator<string[]> {
  let pageToken: string | undefined = undefined

  do {
    const response = await withRetry<any>(() =>
      gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        pageToken,
        includeSpamTrash: false,
      })
    )

    const messages: any[] = response.data.messages || []
    if (messages.length > 0) {
      yield messages.map((m: any) => m.id)
    }

    pageToken = response.data.nextPageToken || undefined

    if (!pageToken) break
  } while (true)
}


export async function fetchMessagesInBatch(
  gmail: any,
  messageIds: string[],
  concurrency = 10
): Promise<any[]> {
  const results: any[] = []

  for (let i = 0; i < messageIds.length; i += concurrency) {
    const batch = messageIds.slice(i, i + concurrency)
    const fetched = await Promise.all(
      batch.map((id) =>
        withRetry(() =>
          gmail.users.messages
            .get({ userId: "me", id, format: "full" })
            .then((r: any) => r.data)
        )
      )
    )
    results.push(...fetched)
  }

  return results
}

export async function fetchHistoryChanges(
  gmail: any,
  startHistoryId: string
): Promise<{ addedMessageIds: string[]; removedMessageIds: string[] }> {
  const addedMessageIds: string[] = []
  const removedMessageIds: string[] = []
  let pageToken: string | undefined = undefined

  try {
    do {
      const response = await withRetry<any>(() =>
        gmail.users.history.list({
          userId: "me",
          startHistoryId,
          pageToken,
          historyTypes: ["messageAdded", "messageDeleted"],
        })
      )

      const history: any[] = response.data.history || []
      for (const h of history) {
        for (const added of h.messagesAdded || []) {
          addedMessageIds.push(added.message.id)
        }
        for (const deleted of h.messagesDeleted || []) {
          removedMessageIds.push(deleted.message.id)
        }
      }

      pageToken = response.data.nextPageToken || undefined
    } while (pageToken)
  } catch (err: any) {
    // historyId too old — need full resync
    if (err?.status === 404) {
      throw new Error("HISTORY_EXPIRED")
    }
    throw err
  }

  return { addedMessageIds, removedMessageIds }
}


export async function sendEmail(
  gmail: any,
  {
    to,
    subject,
    body,
    inReplyTo,
    references,
    threadId,
  }: {
    to: string
    subject: string
    body: string
    inReplyTo?: string
    references?: string
    threadId?: string
  }
): Promise<string> {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : "",
    references ? `References: ${references}` : "",
  ]
    .filter(Boolean)
    .join("\r\n")

  const raw = `${headers}\r\n\r\n${body}`
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  const params: any = { userId: "me", requestBody: { raw: encoded } }
  if (threadId) params.requestBody.threadId = threadId

  const response = await withRetry<any>(() =>
    gmail.users.messages.send(params)
  )
  return response.data.id
}
