# AI-Powered Gmail Intelligence Platform

An advanced web application that connects to your Gmail account, syncs your messages, automatically categorizes and summarizes email threads using AI, and provides a RAG-powered chatbot to search, analyze, and reply to your emails.

Powered by **Next.js 16**, **Supabase (pgvector)**, **Google Gemini 2.5 Flash**, and **NVIDIA NIM (Llama 3.1 8B)**.

---

> [!IMPORTANT]
> **Important Testing & AI Notes:**
> 1. **Google Login is in Testing Mode**: Right now, Google login only works with test email addresses added in our Google Developer Console. Moving the app to "Production" status takes 3 to 5 days because Google needs to verify and approve it. For testing, please use the test email and password shared with you to log in and explore the app.
>    Email    : ssyam4191@gmail.com
>    password : Syam@12345
> 3. **Short Prompts for Free Tier**: We made the AI system prompts short and simple. This reduces the number of tokens used, so the app runs smoothly within the free tier limits of the Gemini API.
> 4. **Dual AI Engines with Auto Backup**: The app uses two AI models: **Google Gemini 2.5 Flash** (Primary Engine) and **NVIDIA NIM Llama 3.1 8B** (Secondary Engine). If a Gemini request fails (due to rate limits, API quotas, or network issues), the app automatically switches to the NVIDIA model to get the response.

---
## Demo Video

[![Watch the Demo](https://img.shields.io/badge/Watch-Demo-blue)](https://github.com/username/repository/blob/main/demo.mp4)


## 🚀 Key Features

1. **Secure Google Login**: Log in safely with your Google account to read, manage, and send emails.
2. **Smart Email Sync**: Syncs your emails in two ways: first, it fetches up to 500 emails, and then it updates only new emails using Google's History API. It handles rate limits by retrying with a delay if Google is busy.
3. **Auto Email Folders (NVIDIA NIM)**: Automatically groups emails into folders like *Finance, Job/Recruitment, Newsletters, Notifications, Personal,* or *Work* using a fast Llama 3.1 AI model.
4. **Email Summaries (Gemini 2.5 Flash)**: Generates quick 2-3 sentence summaries of single emails or entire email threads, listing key decisions and tasks.
5. **AI Email Chatbot (RAG)**: A smart chat assistant that answers questions about your emails. It finds the right emails using smart search and always lists which email the answer came from.
6. **Smart Compose & Reply**: Write new emails or replies easily using simple text prompts. It automatically keeps replies in the same email thread.
7. **Modern Dark UI**: A beautiful dark dashboard with smooth loading animations, a clean sidebar, and an easy-to-use layout.

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
   **Create Frontend/gmail-intelligence/.env.local and add:**
```bash
 ----- Google OAuth -----
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret_here

 ----- NextAuth.js -----
NEXTAUTH_SECRET=your_nextauth_secret_here
AUTH_SECRET=your_auth_secret_here_for_nextauth_v5
NEXTAUTH_URL=http://localhost:3000

 ----- Supabase -----
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

 ----- Google Gemini -----
GEMINI_API_KEY=your_gemini_api_key_here

 ----- NVIDIA NIM -----
NVIDIA_NIM_API_KEY=your_nvidia_nim_api_key_here
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=meta/llama-3.1-8b-instruct
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
