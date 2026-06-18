import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("users").select("*").limit(1)
    if (error) {
      return NextResponse.json({ success: false, error })
    }
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message })
  }
}
