import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({ where: {}, orderBy: { startTime: 'desc' }, skip: (page-1)*size, take: size, include: { tank: { select: { name: true } } } }),
    prisma.trip.count()
  ])

  return NextResponse.json({
    trips: trips.map(t => ({ id: t.id, startTime: t.startTime, endTime: t.endTime, duration: t.duration,
      distance: t.distance, avgSpeed: t.avgSpeed, maxSpeed: t.maxSpeed, fuelConsumed: t.fuelConsumed,
      fuelPer100km: t.fuelPer100km, tankName: t.tank.name, pointCount: t.pointCount })),
    total, page, pageSize: size
  })
}
