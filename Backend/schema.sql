CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  gmail_access_token  TEXT,
  gmail_refresh_token TEXT,
  token_expiry        TIMESTAMPTZ,
  history_id          TEXT,        -- Gmail historyId for incremental sync
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_thread_id  TEXT NOT NULL,
  subject          TEXT,
  summary          TEXT,           -- AI-generated thread summary
  category         TEXT NOT NULL DEFAULT 'Uncategorized',
  participants     TEXT[] NOT NULL DEFAULT '{}',
  last_message_at  TIMESTAMPTZ,
  message_count    INT NOT NULL DEFAULT 0,
  labels           TEXT[] NOT NULL DEFAULT '{}',
  embedding        VECTOR(768),    -- Thread-level embedding for RAG (gemini-text-embedding-004 = 768 dims)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, gmail_thread_id)
);

CREATE TABLE IF NOT EXISTS emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id         UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  gmail_message_id  TEXT NOT NULL UNIQUE,
  gmail_thread_id   TEXT NOT NULL,
  from_email        TEXT NOT NULL,
  from_name         TEXT,
  to_emails         TEXT[] NOT NULL DEFAULT '{}',
  cc_emails         TEXT[] NOT NULL DEFAULT '{}',
  subject           TEXT,
  body_text         TEXT,
  body_html         TEXT,
  snippet           TEXT,
  summary           TEXT,          -- AI-generated per-email summary
  category          TEXT NOT NULL DEFAULT 'Uncategorized',
  labels            TEXT[] NOT NULL DEFAULT '{}',
  in_reply_to       TEXT,          -- Email header for thread preservation
  "references"      TEXT,          -- Email header for thread preservation
  sent_at           TIMESTAMPTZ,
  embedding         VECTOR(768),   -- Per-email embedding for RAG
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  sources     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS sync_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress      INT NOT NULL DEFAULT 0,
  total_emails  INT NOT NULL DEFAULT 0,
  synced_emails INT NOT NULL DEFAULT 0,
  error         TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- Inbox listing: user's emails by date desc
CREATE INDEX IF NOT EXISTS idx_emails_user_sent ON emails(user_id, sent_at DESC);

-- Thread listing: user's threads by last message
CREATE INDEX IF NOT EXISTS idx_threads_user_last ON email_threads(user_id, last_message_at DESC);

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(user_id, category);
CREATE INDEX IF NOT EXISTS idx_threads_category ON email_threads(user_id, category);

-- Sender filtering
CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(user_id, from_email);

-- Thread lookup
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_thread ON emails(gmail_thread_id);

-- Vector similarity search (IVFFlat — fast approximate nearest neighbor)
-- Note: Supabase supports IVFFlat and HNSW. HNSW is better quality but uses more memory.
CREATE INDEX IF NOT EXISTS idx_emails_embedding ON emails
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_threads_embedding ON email_threads
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Sync job status
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user ON sync_jobs(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION match_emails(
  query_embedding  VECTOR(768),
  match_count      INT DEFAULT 10,
  filter_user_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  user_id          UUID,
  thread_id        UUID,
  gmail_message_id TEXT,
  gmail_thread_id  TEXT,
  from_email       TEXT,
  from_name        TEXT,
  subject          TEXT,
  body_text        TEXT,
  snippet          TEXT,
  summary          TEXT,
  category         TEXT,
  sent_at          TIMESTAMPTZ,
  similarity       FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.thread_id,
    e.gmail_message_id,
    e.gmail_thread_id,
    e.from_email,
    e.from_name,
    e.subject,
    e.body_text,
    e.snippet,
    e.summary,
    e.category,
    e.sent_at,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM emails e
  WHERE
    (filter_user_id IS NULL OR e.user_id = filter_user_id)
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users: can only see own row
CREATE POLICY "users_own" ON users FOR ALL USING (id = auth.uid());

-- Threads: can only see own threads
CREATE POLICY "threads_own" ON email_threads FOR ALL USING (user_id = auth.uid());

-- Emails: can only see own emails
CREATE POLICY "emails_own" ON emails FOR ALL USING (user_id = auth.uid());

-- Chat sessions: own only
CREATE POLICY "sessions_own" ON chat_sessions FOR ALL USING (user_id = auth.uid());

-- Chat messages: own only
CREATE POLICY "messages_own" ON chat_messages FOR ALL USING (user_id = auth.uid());

-- Sync jobs: own only
CREATE POLICY "sync_jobs_own" ON sync_jobs FOR ALL USING (user_id = auth.uid());
