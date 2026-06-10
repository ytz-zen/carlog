import { NextResponse, NextRequest } from 'next/server'
import { checkCookieAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  if (!await checkCookieAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')
  const carId = searchParams.get('carId') || undefined

  const where: Record<string, any> = {}
  if (carId) where.carId = carId
  // Exclude currently active trips from history
  where.endTime = { not: null }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({ 
      where, 
      orderBy: { startTime: 'desc' }, 
      skip: (page-1)*size, 
      take: size, 
      include: { tank: { select: { name: true } }, car: { select: { name: true } } } 
    }),
    prisma.trip.count({ where })
  ])

  return NextResponse.json({
    trips: trips.map(t => ({ id: t.id, startTime: t.startTime, endTime: t.endTime, duration: t.duration,
      distance: t.distance, avgSpeed: t.avgSpeed, maxSpeed: t.maxSpeed, fuelConsumed: t.fuelConsumed,
      fuelPer100km: t.fuelPer100km, tankName: t.tank.name, carName: t.car.name, pointCount: t.pointCount })),
    total, page, pageSize: size
  })
}
