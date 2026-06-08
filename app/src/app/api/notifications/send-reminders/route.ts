import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWebhook, formatReminderDigest } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifConfig = await prisma.notificationConfig.findFirst()
  if (!notifConfig || !notifConfig.webhookUrl) {
    return NextResponse.json({ error: '未配置 Webhook URL' }, { status: 400 })
  }

  const content = await formatReminderDigest()
  if (!content) {
    return NextResponse.json({ message: '暂无待处理的提醒', sent: false })
  }

  const ok = await sendWebhook(notifConfig.webhookUrl, content)
  return NextResponse.json({ sent: ok, content: ok ? undefined : content })
}
