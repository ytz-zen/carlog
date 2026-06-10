import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (apiKey) {
    // Android client - find or create
    const car = await prisma.car.findFirst({ orderBy: { lastSeenAt: 'desc' } })
    if (!car) {
      return NextResponse.json({ error: 'No car found' }, { status: 404 })
    }
    const trip = await prisma.trip.findFirst({
      where: { carId: car.id, endTime: null },
      include: { tank: { select: { name: true, capacity: true } } }
    })
    return NextResponse.json({ trip })
  }
  
  // Web client - filter by carId param
  const { searchParams } = new URL(request.url)
  const carId = searchParams.get('carId') || undefined
  
  const where: Record<string, any> = { endTime: null }
  if (carId) where.carId = carId
  
  const trip = await prisma.trip.findFirst({
    where,
    include: { 
      car: { select: { name: true } },
      tank: { select: { name: true, capacity: true } },
      gpsPoints: { select: { id: true } }
    }
  })
  return NextResponse.json({ 
    trip: trip ? { 
      ...trip, 
      uploadedPointCount: trip.gpsPoints.length,
      carName: trip.car.name,
      gpsPoints: undefined 
    } : null 
  })
}
