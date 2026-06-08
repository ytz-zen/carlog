import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const getSecret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || 'carlog_default_secret_change_me_2026'
)

export async function POST(request: Request) {
  const { password } = await request.json()
  const expected = process.env.DASHBOARD_PASSWORD || 'admin'

  if (password !== expected) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  }

  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  const res = NextResponse.json({ ok: true })
  res.cookies.set('carlog_token', token, {
    httpOnly: true,
    secure: false,          // inner container, not HTTPS
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })

  return res
}
