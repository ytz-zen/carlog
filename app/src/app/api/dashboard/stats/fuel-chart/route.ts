import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { subDays, startOfDay, eachDayOfInterval, format, eachWeekOfInterval, endOfWeek, eachMonthOfInterval, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const granularity = searchParams.get('granularity') || 'day'
  const period = parseInt(searchParams.get('period') || '30')
  const rangeStart = startOfDay(subDays(new Date(), period))
  const rangeEnd = new Date()

  let labels: string[] = []
  const fuelData: (number | null)[] = []
  const costData: (number | null)[] = []

  if (granularity === 'day') {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    labels = days.map(d => format(d, 'MM/dd'))
    for (const day of days) {
      const ds = startOfDay(day), de = new Date(ds.getTime() + 86400000)
      const res = await prisma.fuelEvent.aggregate({
        where: { timestamp: { gte: ds, lt: de } }, _sum: { fuelAdded: true, totalPrice: true }
      })
      fuelData.push(Math.round((res._sum.fuelAdded || 0) * 10) / 10)
      costData.push(Math.round((res._sum.totalPrice || 0) * 100) / 100)
    }
  } else if (granularity === 'month') {
    const months: Date[] = []
    let current = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    while (current <= rangeEnd) { months.push(current); current = new Date(current.getFullYear(), current.getMonth() + 1, 1) }
    labels = months.map(d => format(d, 'yyyy/MM'))
    for (const ms of months) {
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1)
      const res = await prisma.fuelEvent.aggregate({ where: { timestamp: { gte: ms, lt: me } }, _sum: { fuelAdded: true, totalPrice: true } })
      fuelData.push(Math.round((res._sum.fuelAdded || 0) * 10) / 10)
      costData.push(Math.round((res._sum.totalPrice || 0) * 100) / 100)
    }
  } else {
    const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd })
    labels = weeks.map(d => format(d, 'MM/dd'))
    for (const ws of weeks) {
      const we = endOfWeek(ws)
      const res = await prisma.fuelEvent.aggregate({ where: { timestamp: { gte: ws, lte: we } }, _sum: { fuelAdded: true, totalPrice: true } })
      fuelData.push(Math.round((res._sum.fuelAdded || 0) * 10) / 10)
      costData.push(Math.round((res._sum.totalPrice || 0) * 100) / 100)
    }
  }

  return NextResponse.json({ granularity, labels, fuelAdded: fuelData, totalPrice: costData })
}
