import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { action, password, apiKey } = await request.json()

  if (action === 'register') {
    const existing = await prisma.apiKey.findFirst()
    if (existing) return NextResponse.json({ error: 'Already registered' }, { status: 409 })
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password too short' }, { status: 400 })

    const key = 'ck_' + Math.random().toString(36).substring(2, 16)
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    const hashStr = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('')

    const record = await prisma.apiKey.create({ data: { key, passwordHash: hashStr } })
    return NextResponse.json({ apiKey: record.key })
  }

  if (action === 'login') {
    if (!apiKey) return NextResponse.json({ error: 'API key required' }, { status: 400 })
    const record = await prisma.apiKey.findFirst()
    if (!record) return NextResponse.json({ error: 'Not registered' }, { status: 401 })
    if (apiKey !== record.key) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    return NextResponse.json({ success: true, apiKey })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
