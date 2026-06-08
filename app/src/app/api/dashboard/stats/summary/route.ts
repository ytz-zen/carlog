import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { addDays, subDays, startOfDay } from 'date-fns'

export async function GET() {
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
    const where = p.start ? { startTime: p.start ? { gte: p.start } : undefined } : {}
    const [tripCount, tripSum, fuelSum, spentSum] = await Promise.all([
      prisma.trip.count({ where }),
      prisma.trip.aggregate({ where, _sum: { distance: true } }),
      prisma.fuelEvent.aggregate({ where: p.start ? { timestamp: { gte: p.start } } : {}, _sum: { fuelAdded: true } }),
      prisma.fuelEvent.aggregate({ where: p.start ? { timestamp: { gte: p.start }, totalPrice: { not: null } } : { totalPrice: { not: null } }, _sum: { totalPrice: true } })
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
