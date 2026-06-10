import { NextResponse, NextRequest } from 'next/server'
import { checkCookieAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { subDays, startOfDay, format } from 'date-fns'

export async function GET(request: NextRequest) {
  if (!await checkCookieAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const period = parseInt(searchParams.get('period') || '30')
  const carId = searchParams.get('carId') || undefined
  const rangeStart = startOfDay(subDays(new Date(), period))

  const where: Record<string, any> = { startTime: { gte: rangeStart }, fuelPer100km: { not: null } }
  if (carId) where.carId = carId

  const trips = await prisma.trip.findMany({
    where,
    select: { startTime: true, distance: true, fuelPer100km: true, duration: true },
    orderBy: { startTime: 'asc' }
  })

  return NextResponse.json({
    labels: trips.map(t => format(t.startTime, 'MM/dd')),
    data: trips.map(t => ({ date: format(t.startTime, 'MM/dd'), per100km: t.fuelPer100km, distance: t.distance }))
  })
}
