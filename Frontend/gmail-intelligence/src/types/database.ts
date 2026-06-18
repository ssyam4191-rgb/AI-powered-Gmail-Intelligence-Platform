export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type EmailCategory =
  | "Newsletter"
  | "Job/Recruitment"
  | "Finance"
  | "Notifications"
  | "Personal"
  | "Work/Professional"
  | "Uncategorized"

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          gmail_access_token: string | null
          gmail_refresh_token: string | null
          token_expiry: string | null
          history_id: string | null
          last_synced_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          gmail_access_token?: string | null
          gmail_refresh_token?: string | null
          token_expiry?: string | null
          history_id?: string | null
          last_synced_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          gmail_access_token?: string | null
          gmail_refresh_token?: string | null
          token_expiry?: string | null
          history_id?: string | null
          last_synced_at?: string | null
          created_at?: string
        }
      }
      email_threads: {
        Row: {
          id: string
          user_id: string
          gmail_thread_id: string
          subject: string | null
          summary: string | null
          category: EmailCategory
          participants: string[]
          last_message_at: string | null
          message_count: number
          labels: string[]
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gmail_thread_id: string
          subject?: string | null
          summary?: string | null
          category?: EmailCategory
          participants?: string[]
          last_message_at?: string | null
          message_count?: number
          labels?: string[]
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gmail_thread_id?: string
          subject?: string | null
          summary?: string | null
          category?: EmailCategory
          participants?: string[]
          last_message_at?: string | null
          message_count?: number
          labels?: string[]
          embedding?: number[] | null
          created_at?: string
        }
      }
      emails: {
        Row: {
          id: string
          user_id: string
          thread_id: string
          gmail_message_id: string
          gmail_thread_id: string
          from_email: string
          from_name: string | null
          to_emails: string[]
          cc_emails: string[]
          subject: string | null
          body_text: string | null
          body_html: string | null
          snippet: string | null
          summary: string | null
          category: EmailCategory
          labels: string[]
          in_reply_to: string | null
          references: string | null
          sent_at: string | null
          embedding: number[] | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          thread_id: string
          gmail_message_id: string
          gmail_thread_id: string
          from_email: string
          from_name?: string | null
          to_emails?: string[]
          cc_emails?: string[]
          subject?: string | null
          body_text?: string | null
          body_html?: string | null
          snippet?: string | null
          summary?: string | null
          category?: EmailCategory
          labels?: string[]
          in_reply_to?: string | null
          references?: string | null
          sent_at?: string | null
          embedding?: number[] | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          thread_id?: string
          gmail_message_id?: string
          gmail_thread_id?: string
          from_email?: string
          from_name?: string | null
          to_emails?: string[]
          cc_emails?: string[]
          subject?: string | null
          body_text?: string | null
          body_html?: string | null
          snippet?: string | null
          summary?: string | null
          category?: EmailCategory
          labels?: string[]
          in_reply_to?: string | null
          references?: string | null
          sent_at?: string | null
          embedding?: number[] | null
          is_read?: boolean
          created_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          user_id: string
          role: "user" | "assistant"
          content: string
          sources: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          role: "user" | "assistant"
          content: string
          sources?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          role?: "user" | "assistant"
          content?: string
          sources?: Json | null
          created_at?: string
        }
      }
      sync_jobs: {
        Row: {
          id: string
          user_id: string
          status: "pending" | "running" | "completed" | "failed"
          progress: number
          total_emails: number
          synced_emails: number
          error: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: "pending" | "running" | "completed" | "failed"
          progress?: number
          total_emails?: number
          synced_emails?: number
          error?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: "pending" | "running" | "completed" | "failed"
          progress?: number
          total_emails?: number
          synced_emails?: number
          error?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {
      match_emails: {
        Args: {
          query_embedding: number[]
          match_count: number
          filter_user_id: string
        }
        Returns: {
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
        }[]
      }
    }
    Enums: {}
  }
}

// Convenience types
export type UserRow = Database["public"]["Tables"]["users"]["Row"]
export type EmailRow = Database["public"]["Tables"]["emails"]["Row"]
export type ThreadRow = Database["public"]["Tables"]["email_threads"]["Row"]
export type ChatSessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"]
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"]
export type SyncJobRow = Database["public"]["Tables"]["sync_jobs"]["Row"]

export interface EmailSource {
  email_id: string
  gmail_message_id: string
  subject: string | null
  from_email: string
  from_name: string | null
  sent_at: string | null
  snippet: string | null
  similarity?: number
}
