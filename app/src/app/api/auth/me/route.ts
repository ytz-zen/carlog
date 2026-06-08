import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || 'carlog_default_secret_change_me_2026'
)

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/carlog_token=([^;]+)/)
  if (!match) return NextResponse.json({ authed: false })

  try {
    await jwtVerify(match[1], getSecret())
    return NextResponse.json({ authed: true })
  } catch {
    return NextResponse.json({ authed: false })
  }
}
