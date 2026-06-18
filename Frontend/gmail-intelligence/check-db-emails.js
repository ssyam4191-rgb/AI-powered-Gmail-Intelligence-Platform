require("dotenv").config();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env variables");
    return;
  }

  // Fetch users
  try {
    const resUsers = await fetch(`${supabaseUrl}/rest/v1/users`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const users = await resUsers.json();
    console.log(`Total users in DB: ${users.length}`);
    if (Array.isArray(users)) {
      users.forEach(u => console.log(`  User ID: ${u.id}, Email: ${u.email}`));
    } else {
      console.log("Response users:", users);
    }
  } catch (err) {
    console.error("Error fetching users:", err);
  }

  // Fetch emails count and info
  try {
    const resEmails = await fetch(`${supabaseUrl}/rest/v1/emails?select=id,user_id,subject,embedding,category&limit=5`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "count=exact"
      }
    });
    const countHeader = resEmails.headers.get("content-range");
    const emails = await resEmails.json();
    console.log(`Total emails count (Content-Range): ${countHeader}`);
    console.log(`Sample emails (up to 5):`);
    if (Array.isArray(emails)) {
      emails.forEach((e, idx) => {
        console.log(`  Email ${idx + 1}:`);
        console.log(`    ID: ${e.id}`);
        console.log(`    User ID: ${e.user_id}`);
        console.log(`    Subject: ${e.subject}`);
        console.log(`    Category: ${e.category}`);
        console.log(`    Has Embedding: ${e.embedding !== null}`);
        if (e.embedding) {
          console.log(`    Embedding info type: ${typeof e.embedding}`);
        }
      });
    } else {
      console.log("Response emails:", emails);
    }
  } catch (err) {
    console.error("Error fetching emails:", err);
  }
}

main();
