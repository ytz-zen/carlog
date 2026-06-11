import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { checkCookieAuth, getApiKey } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const logs: string[] = body.logs || []
    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // 获取最新一条日志判断 carId
    let carId: string | undefined
    try {
      const car = await prisma.car.findFirst({
        where: { isOnline: true },
        select: { id: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 1,
      })
      if (car) carId = car.id
    } catch {}

    const now = new Date()
    const entries = logs.slice(-200).map((line: string) => {
      // 解析格式: "TAG|message"
      const pipeIdx = line.indexOf('|')
      let level = 'info'
      let message = line
      if (pipeIdx > 0) {
        const tag = line.substring(0, pipeIdx).toUpperCase()
        message = line.substring(pipeIdx + 1)
        if (tag.includes('FAIL') || tag.includes('❌') || tag.includes('💥')) level = 'error'
        else if (tag.includes('WARN') || tag.includes('⚠️')) level = 'warn'
      }
      // 清理 emoji 用于更整洁的存储
      message = message.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/gu, '').trim()
      return { carId, timestamp: now, level, message, source: 'android' }
    })

    await prisma.androidLog.createMany({ data: entries })

    // 清理超过24小时的日志（每次收到新日志时顺带清理）
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await prisma.androidLog.deleteMany({ where: { timestamp: { lt: cutoff } } })

    return NextResponse.json({ ok: true, count: entries.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  const hasApiKey = apiKey && apiKey === await getApiKey()
  const hasCookie = await checkCookieAuth(request)
  if (!hasApiKey && !hasCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const carId = searchParams.get('carId') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
  const level = searchParams.get('level') || undefined

  const where: Record<string, any> = {}
  if (carId) where.carId = carId
  if (level) where.level = level

  const logs = await prisma.androidLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
    select: {
      id: true,
      timestamp: true,
      level: true,
      message: true,
      source: true,
      carId: true,
    },
  })

  return NextResponse.json({ logs: logs.reverse() })
}
