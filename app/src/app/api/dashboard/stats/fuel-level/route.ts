import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkCookieAuth } from '@/lib/auth'

export async function GET(request: Request) {
  if (!await checkCookieAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const period = parseInt(url.searchParams.get('period') || '30')
  const rangeStart = new Date(Date.now() - period * 86400000)

  const points = await prisma.gpsPoint.findMany({
    where: { timestamp: { gte: rangeStart }, fuelLevel: { not: null } },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, fuelLevel: true },
  })

  const dailyMap = new Map<string, { total: number; count: number; min: number; max: number }>()
  let prevLevel: number | null = null
  const refuelEvents: { date: string; before: number; after: number; added: number }[] = []

  for (const p of points) {
    const day = p.timestamp.toISOString().slice(0, 10)
    const level = p.fuelLevel
    if (level == null) continue

    const entry = dailyMap.get(day) || { total: 0, count: 0, min: level, max: level }
    entry.total += level; entry.count++
    if (level < entry.min) entry.min = level
    if (level > entry.max) entry.max = level
    dailyMap.set(day, entry)

    if (prevLevel != null && level - prevLevel > 8) {
      refuelEvents.push({ date: day, before: Math.round(prevLevel * 10) / 10, after: Math.round(level * 10) / 10, added: Math.round((level - prevLevel) * 10) / 10 })
    }
    prevLevel = level
  }

  const daily = Array.from(dailyMap.entries()).map(([date, d]) => ({
    date, avg: Math.round(d.total / d.count * 10) / 10, min: Math.round(d.min * 10) / 10, max: Math.round(d.max * 10) / 10,
  })).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ daily, refuelEvents })
}
