/**
 * GET /api/gmail/sync/status?jobId=...
 * Returns the current progress of a sync job
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jobId = req.nextUrl.searchParams.get("jobId")
  const supabase = createAdminClient()

  if (jobId) {
    const { data } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", session.userId)
      .single()

    return NextResponse.json(data || { error: "Job not found" })
  }

  // Return latest sync job for this user
  const { data } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json(data || null)
}
