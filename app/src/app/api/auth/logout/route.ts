import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('carlog_token', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}
