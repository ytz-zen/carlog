import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWebhook, formatDailyDigest } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = await prisma.notificationConfig.findMany({ where: { dailyDigest: true }, include: { car: true } })
  const results: any[] = []
  for (const config of configs) {
    const digest = await formatDailyDigest(new Date())
    const ok = await sendWebhook(config.webhookUrl, digest)
    results.push({ carId: config.car.id, sent: ok })
  }
  return NextResponse.json({ results })
}
