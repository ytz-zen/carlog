import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkCookieAuth } from '@/lib/auth'

const SETTINGS_KEYS = ['tianditu_key', 'webhook_url', 'dashboard_password', 'push_trip_start', 'push_trip_end'] as const

export async function GET() {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: SETTINGS_KEYS as unknown as string[] } }
  })
  const result: Record<string, string> = {}
  for (const r of rows) result[r.key] = r.value
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  if (!await checkCookieAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await request.json()
  for (const [key, value] of Object.entries(data)) {
    if (!SETTINGS_KEYS.includes(key as any)) continue
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })
  }
  return NextResponse.json({ ok: true })
}
