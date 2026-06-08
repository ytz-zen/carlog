import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { subDays, startOfDay, eachDayOfInterval, format, eachWeekOfInterval, endOfWeek } from 'date-fns'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const granularity = searchParams.get('granularity') || 'day'
  const period = parseInt(searchParams.get('period') || '30')
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
      const trips = await prisma.trip.findMany({ where: { startTime: { gte: ds, lt: de } }, select: { distance: true, duration: true } })
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
      const trips = await prisma.trip.findMany({ where: { startTime: { gte: ws, lte: we } }, select: { distance: true, duration: true } })
      const totalDist = trips.reduce((s, t) => s + (t.distance || 0), 0)
      const totalDur = trips.reduce((s, t) => s + (t.duration || 0), 0)
      distanceData.push(Math.round(totalDist * 10) / 10)
      durationData.push(totalDur > 0 ? totalDur / 60 : 0)
    }
  }

  // Fuel data
  const tripsIn = await prisma.trip.findMany({
    where: { startTime: { gte: rangeStart, lte: rangeEnd } },
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
