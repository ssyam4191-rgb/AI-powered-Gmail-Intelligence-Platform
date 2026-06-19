# AI-Powered Gmail Intelligence Platform

An advanced web application that connects to your Gmail account, syncs your messages, automatically categorizes and summarizes email threads using AI, and provides a RAG-powered chatbot to search, analyze, and reply to your emails.

Powered by **Next.js 16**, **Supabase (pgvector)**, **Google Gemini 2.5 Flash**, and **NVIDIA NIM (Llama 3.1 8B)**.

---

> [!IMPORTANT]
> **Key Implementation & Testing Notes:**
> 1. **Google OAuth is in Testing Phase**: Google Sign-In currently requires pre-registered testing user emails in the Google Cloud Console. Transitioning the OAuth screen to the "Production" status takes 3-5 days for Google's official review and approval. For convenience during evaluation, a **test Gmail account (email and password)** has been shared; please use these credentials to log in and explore the platform.
> 2. **Token Optimization**: System prompts across all AI features are carefully optimized and kept brief to minimize input token usage, accommodating the limits of the Gemini API free tier.
> 3. **Dual AI Engines with Auto-Fallback**: The platform integrates two AI endpoints—**Google Gemini 2.5 Flash** (Primary Engine) and **NVIDIA NIM Llama 3.1 8B** (Secondary Engine). If a primary Gemini request fails (due to rate limits, API quotas, or network issues), the app automatically falls back to NVIDIA NIM to complete the request and keep the app functional.

---

## 🚀 Key Features

1. **Google OAuth 2.0 Login**: Secure authentication with Google to retrieve granular scopes (`gmail.readonly`, `gmail.send`, `gmail.modify`, `gmail.labels`).
2. **Robust Sync Engine**: Dual sync modes (initial full sync up to 500 emails, followed by incremental updates using the Gmail History API). Handles rate limiting gracefully with exponential backoff.
3. **Automated AI Categorization (NVIDIA NIM)**: Uses low-latency Llama 3.1 8B Instruct model to classify incoming emails into specific folders (*Finance, Job/Recruitment, Newsletters, Notifications, Personal, Work/Professional*).
4. **Thread-Level AI Summarization (Gemini 2.5 Flash)**: Generates high-quality per-email and multi-message thread summaries, highlighting action items and core decisions.
5. **Conversational RAG Agent (Gemini + pgvector)**: An AI assistant that answers questions about your emails using hybrid semantic and keyword search. Answers are fully grounded in your inbox and attribute source citations.
6. **Smart Compose & Contextual Reply**: Draft professional emails using natural language prompts or reply to threads preserving full mail headers (`In-Reply-To` and `References`) to keep threads organized.
7. **Premium Dark UI**: Built with a sleek dark-themed dashboard using glassmorphism, responsive sidebar navigation, loading skeletons, and interactive state indicators.

---

## 🛠️ Technology Stack

- **Frontend / Backend**: Next.js 16 (App Router), React 19, TypeScript
- **Auth**: NextAuth.js v5 (Auth.js)
- **Database / Vector Search**: Supabase, PostgreSQL with `pgvector` extension
- **LLMs & Embeddings**: Google Gemini 2.5 Flash, Gemini `gemini-embedding-2`
- **Secondary LLM**: NVIDIA NIM (Llama-3.1-8b-instruct)
- **Styling**: TailwindCSS, Lucide React icons, Tailwind glassmorphism

---

## 📁 Project Structure

```
Gmail Intelligence Platform/
├── Frontend/                    # Next.js App
│   ├── src/
│   │   ├── app/                 # Next.js Routing
│   │   │   ├── (auth)/login/    # Google Login Page
│   │   │   ├── inbox/           # Main Dashboard (Thread List)
│   │   │   ├── thread/[id]/     # Thread View & Reply Panel
│   │   │   ├── chat/            # Conversational Chat Agent
│   │   │   ├── sync/            # Sync Progress Screen
│   │   │   └── api/             # API Endpoints
│   │   ├── components/          # Reusable React components
│   │   ├── lib/                 # Core AI/Gmail utilities & Supabase client
│   │   ├── types/               # TypeScript interface configurations
│   │   └── auth.ts              # NextAuth core configuration
│   ├── package.json
│   └── tsconfig.json
├── Backend/                     # Supabase database config
│   └── schema.sql               # Database setup migrations
├── Architecture.md              # System Architecture & Design Doc
├── README.md                    # Project Documentation
└── .env.example                 # Environment variables config
```

---

## ⚙️ Setup & Installation

### Prerequisite Accounts & Keys
1. **Google Cloud Console**: Enable Gmail API. Create an OAuth 2.0 Client ID and Secret. Redirect URI: `http://localhost:3000/api/auth/callback/google`
2. **Supabase**: Create a project, enable the `vector` extension.
3. **Google AI Studio**: Create a Gemini API Key.
4. **NVIDIA NIM**: Register at build.nvidia.com and get an API Key for Llama 3.1 8B.

### Step-by-Step Installation

1. **Clone the Repository** and navigate to the Next.js app:
   ```bash
   cd Frontend/gmail-intelligence
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `Frontend/gmail-intelligence/.env.local` and add your credentials:
   ```bash
   cp ../../.env.example .env.local
   ```

4. **Initialize the Database**:
   Log in to your Supabase Dashboard, open the **SQL Editor**, and paste the contents of `Backend/schema.sql` to construct the tables, indexes, RLS policies, and similarity search functions.

5. **Start Local Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Verification & Development

To test the application locally:
- Run `npm run build` to verify there are no TypeScript or compilation errors.
- Ensure all environment variables are correctly populated in `.env.local`.
- Run `npm run lint` to enforce formatting guidelines.

---

## 🔒 Security Policy

- All database connections use RLS, ensuring users can only read or write email data associated with their authenticated profile UID.
- Tokens are stored encrypted in the database.
- Sessions are managed server-side using secure encrypted JWT cookies.