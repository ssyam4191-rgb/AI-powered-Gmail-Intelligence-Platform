import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { composeEmail } from "@/lib/gemini"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prompt } = await req.json()
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
  }

  const draft = await composeEmail(prompt)
  return NextResponse.json(draft)
}
