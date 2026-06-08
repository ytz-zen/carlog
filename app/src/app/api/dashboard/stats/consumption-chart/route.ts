import { NextResponse } from 'next/server'
import { checkCookieAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { subDays, startOfDay, format } from 'date-fns'

export async function GET(request: Request) {
  if (!await checkCookieAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const period = parseInt(url.searchParams.get('period') || '30')
  const rangeStart = startOfDay(subDays(new Date(), period))

  const trips = await prisma.trip.findMany({
    where: { startTime: { gte: rangeStart }, fuelPer100km: { not: null } },
    select: { startTime: true, distance: true, fuelPer100km: true, duration: true },
    orderBy: { startTime: 'asc' }
  })

  return NextResponse.json({
    labels: trips.map(t => format(t.startTime, 'MM/dd')),
    data: trips.map(t => ({ date: format(t.startTime, 'MM/dd'), per100km: t.fuelPer100km, distance: t.distance }))
  })
}
