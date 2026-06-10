import { NextResponse, NextRequest } from 'next/server'
import { checkCookieAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { subDays, startOfDay, eachDayOfInterval, format, eachWeekOfInterval, endOfWeek } from 'date-fns'

export async function GET(request: NextRequest) {
  if (!await checkCookieAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const granularity = searchParams.get('granularity') || 'day'
  const period = parseInt(searchParams.get('period') || '30')
  const carId = searchParams.get('carId') || undefined
  const rangeStart = startOfDay(subDays(new Date(), period))
  const rangeEnd = new Date()

  let labels: string[] = []
  const distanceData: (number | null)[] = []
  const durationData: (number | null)[] = []
  const fuelData: (number | null)[] = []

  if (granularity === 'day') {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    labels = days.map(d => format(d, 'MM/dd'))
    for (const day of days) {
      const ds = startOfDay(day), de = new Date(ds.getTime() + 86400000)
      const where: Record<string, any> = { startTime: { gte: ds, lt: de } }
      if (carId) where.carId = carId
      const trips = await prisma.trip.findMany({ where, select: { distance: true, duration: true } })
      const totalDist = trips.reduce((s, t) => s + (t.distance || 0), 0)
      const totalDur = trips.reduce((s, t) => s + (t.duration || 0), 0)
      distanceData.push(totalDist > 0 ? Math.round(totalDist * 10) / 10 : 0)
      durationData.push(totalDur > 0 ? totalDur / 60 : 0)
    }
  } else {
    const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd })
    labels = weeks.map(d => format(d, 'MM/dd'))
    for (const ws of weeks) {
      const we = endOfWeek(ws)
      const where: Record<string, any> = { startTime: { gte: ws, lte: we } }
      if (carId) where.carId = carId
      const trips = await prisma.trip.findMany({ where, select: { distance: true, duration: true } })
      const totalDist = trips.reduce((s: number, t: any) => s + (t.distance || 0), 0)
      const totalDur = trips.reduce((s: number, t: any) => s + (t.duration || 0), 0)
      distanceData.push(Math.round(totalDist * 10) / 10)
      durationData.push(totalDur > 0 ? totalDur / 60 : 0)
    }
  }

  // Fuel data
  const tripWhere: Record<string, any> = { startTime: { gte: rangeStart, lte: rangeEnd } }
  if (carId) tripWhere.carId = carId
  const tripsIn = await prisma.trip.findMany({
    where: tripWhere,
    include: { tank: true }
  })
  for (const t of tripsIn) {
    const events = await prisma.fuelEvent.findMany({
      where: { tankId: t.tankId, timestamp: { gte: t.startTime, lte: (t.endTime || new Date()) } }
    })
    fuelData.push(events.reduce((s, e) => s + e.fuelAdded, 0))
  }

  return NextResponse.json({ granularity, labels, distance: distanceData, duration: durationData, fuel: fuelData })
}
