import { client, setTokens } from "../../auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")

  try {
    const tokens = await client.exchange(code!, `${url.origin}/api/callback`)
    await setTokens(tokens.access, tokens.refresh)

    return NextResponse.redirect(`${url.origin}/`)
  } catch (e) {
    return NextResponse.json(e, { status: 500 })
  }
}
