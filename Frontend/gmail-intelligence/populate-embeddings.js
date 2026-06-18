const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    console.error("Missing SUPABASE or GEMINI env variables");
    return;
  }

  // Use fetch-based supabase query to bypass WebSocket issue
  console.log("Initializing clients...");
  const genAI = new GoogleGenerativeAI(geminiKey);
  const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

  const headers = {
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  // Helper to generate embedding
  async function getEmbedding(text) {
    const res = await embedModel.embedContent({
      content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      outputDimensionality: 768
    });
    return res.embedding.values;
  }

  // 1. Process Emails
  console.log("Fetching emails with null embeddings...");
  const resEmails = await fetch(`${supabaseUrl}/rest/v1/emails?embedding=is.null&select=id,subject,from_email,from_name,body_text,snippet`, {
    headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` }
  });
  const emails = await resEmails.json();
  
  if (!Array.isArray(emails)) {
    console.error("Failed to load emails:", emails);
  } else {
    console.log(`Found ${emails.length} emails needing embeddings.`);
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const text = [
        email.subject,
        email.from_email,
        email.from_name,
        email.body_text?.slice(0, 3000) || email.snippet
      ].filter(Boolean).join(" ");

      try {
        const embedding = await getEmbedding(text);
        
        await fetch(`${supabaseUrl}/rest/v1/emails?id=eq.${email.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ embedding })
        });
        console.log(`[${i + 1}/${emails.length}] Generated embedding for email: "${email.subject}"`);
      } catch (err) {
        console.error(`Failed email ${email.id}:`, err.message);
      }
    }
  }

  // 2. Process Email Threads
  console.log("\nFetching email threads with null embeddings...");
  const resThreads = await fetch(`${supabaseUrl}/rest/v1/email_threads?embedding=is.null&select=id,subject,summary,participants`, {
    headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` }
  });
  const threads = await resThreads.json();

  if (!Array.isArray(threads)) {
    console.error("Failed to load threads:", threads);
  } else {
    console.log(`Found ${threads.length} threads needing embeddings.`);
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const participantsStr = Array.isArray(thread.participants) ? thread.participants.join(" ") : "";
      const text = [
        thread.subject,
        participantsStr,
        thread.summary
      ].filter(Boolean).join(" ");

      try {
        const embedding = await getEmbedding(text);
        
        await fetch(`${supabaseUrl}/rest/v1/email_threads?id=eq.${thread.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ embedding })
        });
        console.log(`[${i + 1}/${threads.length}] Generated embedding for thread: "${thread.subject}"`);
      } catch (err) {
        console.error(`Failed thread ${thread.id}:`, err.message);
      }
    }
  }

  console.log("\nDone! All embeddings have been generated and updated in Supabase.");
}

main();
