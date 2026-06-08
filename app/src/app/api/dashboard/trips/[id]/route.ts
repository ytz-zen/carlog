import { NextRequest, NextResponse } from 'next/server'
import { checkCookieAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkCookieAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const trip = await prisma.trip.findUnique({ where: { id }, include: { tank: { select: { name: true } } } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const points = await prisma.gpsPoint.findMany({
    where: { tripId: id }, orderBy: { timestamp: 'asc' },
    select: { timestamp: true, latitude: true, longitude: true, speed: true, altitude: true, bearing: true }
  })

  return NextResponse.json({
    trip: { id: trip.id, startTime: trip.startTime, endTime: trip.endTime, duration: trip.duration,
            distance: trip.distance, avgSpeed: trip.avgSpeed, maxSpeed: trip.maxSpeed,
            fuelConsumed: trip.fuelConsumed, fuelPer100km: trip.fuelPer100km, tankName: trip.tank.name },
    points: points.map(p => ({ timestamp: p.timestamp, lat: p.latitude, lng: p.longitude, speed: p.speed, altitude: p.altitude, bearing: p.bearing }))
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.gpsPoint.deleteMany({ where: { tripId: id } })
  await prisma.trip.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
