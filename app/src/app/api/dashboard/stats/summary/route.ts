import { NextResponse, NextRequest } from 'next/server'
import { checkCookieAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { addDays, subDays, startOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  if (!await checkCookieAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const carId = searchParams.get('carId') || undefined
  const now = new Date()
  const startToday = startOfDay(now)
  const startWeek = startOfDay(subDays(now, now.getDay() || 7))
  const startMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))

  const periods = [
    { key: 'today', start: startToday },
    { key: 'week', start: startWeek },
    { key: 'month', start: startMonth },
    { key: 'total', start: null }
  ]

  const result: Record<string, any> = {}

  for (const p of periods) {
    const where: Record<string, any> = {}
    if (carId) where.carId = carId
    if (p.start) where.startTime = { gte: p.start }

    const [tripCount, tripSum, fuelSum, spentSum] = await Promise.all([
      prisma.trip.count({ where }),
      prisma.trip.aggregate({ where, _sum: { distance: true } }),
      prisma.fuelEvent.aggregate({ where: { ...(p.start ? { timestamp: { gte: p.start } } : {}), ...(carId ? { carId } : {}) } }),
      prisma.fuelEvent.aggregate({ where: { ...(p.start ? { timestamp: { gte: p.start } } : {}), ...(carId ? { carId } : {}), totalPrice: { not: null } } })
    ])

    const r2 = (v: number | null | undefined) => v !== null && v !== undefined ? Math.round(v * 100) / 100 : 0
    result[p.key] = {
      trips: tripCount,
      distance: r2(tripSum._sum.distance),
      fuel: r2(fuelSum._sum.fuelAdded),
      spent: r2(spentSum._sum.totalPrice)
    }
  }

  return NextResponse.json(result)
}
