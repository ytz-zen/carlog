import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWebhook, formatTripMessage, formatDailyDigest } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const where: Record<string, any> = {}
  if (startDate || endDate) {
    where.startTime = {} as Record<string, Date>
    if (startDate) where.startTime.gte = new Date(startDate)
    if (endDate) where.startTime.lte = new Date(endDate)
  }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where, orderBy: { startTime: 'desc' }, skip: (page - 1) * size, take: size,
      include: { tank: { select: { name: true, capacity: true } } }
    }),
    prisma.trip.count({ where })
  ])

  return NextResponse.json({
    trips: trips.map(t => ({
      id: t.id, carId: t.carId, tankName: t.tank.name,
      startTime: t.startTime, endTime: t.endTime, duration: t.duration,
      distance: t.distance, avgSpeed: t.avgSpeed, maxSpeed: t.maxSpeed,
      fuelConsumed: t.fuelConsumed, fuelPer100km: t.fuelPer100km,
      pointCount: t.pointCount
    })),
    total, page, pageSize: size
  })
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  // === START TRIP ===
  if (action === 'start') {
    const existing = await prisma.trip.findFirst({ where: { endTime: null } })
    if (existing) {
      return NextResponse.json({ error: 'Trip already active', tripId: existing.id }, { status: 409 })
    }
    let car = await prisma.car.findFirst()
    if (!car) car = await prisma.car.create({ 
      data: { name: '我的车', tank: { create: { name: '主油箱', capacity: 60 } } }
    })
    let tank = await prisma.tank.findFirst({ include: { car: true } })
    if (!tank) {
      tank = await prisma.tank.create({ data: { name: '主油箱', capacity: 60 }, include: { car: true } })
      car = await prisma.car.update({ where: { id: car.id }, data: { tankId: tank.id } })
    }
    const trip = await prisma.trip.create({
      data: { carId: car.id, tankId: tank.id, startTime: new Date(), endTime: null, pointCount: 0 }
    })
    return NextResponse.json({ tripId: trip.id, state: 'STARTING', carId: car.id, tankId: tank.id })
  }

  // === END TRIP ===
  if (action === 'end') {
    const { tripId, endTime } = body
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    const trip = await prisma.trip.findUnique({ where: { id: tripId } })
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.endTime) return NextResponse.json({ error: 'Already ended' }, { status: 409 })

    const points = await prisma.gpsPoint.findMany({ where: { tripId }, orderBy: { timestamp: 'asc' } })
    let distance = 0, maxSpeed = 0, totalSpeed = 0, speedCount = 0
    if (points.length >= 2) {
      for (let i = 1; i < points.length; i++) {
        distance += haversine(points[i-1].latitude, points[i-1].longitude, points[i].latitude, points[i].longitude)
        if (points[i].speed > maxSpeed) maxSpeed = points[i].speed
        if (points[i].speed > 5) { totalSpeed += points[i].speed; speedCount++ }
      }
    }
    distance = Math.round(distance * 10) / 10
    const startTime = new Date(trip.startTime)
    const endTs = endTime ? new Date(endTime) : new Date()
    const durationSec = Math.floor((endTs.getTime() - startTime.getTime()) / 1000)
    const avgSpeed = speedCount > 0 ? Math.round(totalSpeed / speedCount * 10) / 10 : 0

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: { endTime: endTs, duration: durationSec,
              distance: distance > 0 ? distance : null,
              maxSpeed: maxSpeed > 0 ? maxSpeed : null,
              avgSpeed: avgSpeed > 0 ? avgSpeed : null, pointCount: points.length }
    })

    // Fuel consumed
    let fuelConsumed: number | null = null
    let fuelPer100km: number | null = null
    if (distance && distance > 0) {
      const fuelEvents = await prisma.fuelEvent.findMany({
        where: { tankId: trip.tankId, timestamp: { gte: trip.startTime, lte: endTs } }
      })
      if (fuelEvents.length > 0) {
        fuelConsumed = fuelEvents.reduce((s, e) => s + e.fuelAdded, 0)
        fuelPer100km = Math.round(fuelConsumed / distance * 1000) / 10
      }
    }
    if (fuelConsumed !== null) {
      await prisma.trip.update({ where: { id: tripId }, data: { fuelConsumed, fuelPer100km } })
    }

    // Trigger notification
    const config = await prisma.notificationConfig.findFirst({ where: { carId: trip.carId, onTripEnd: true } })
    if (config) {
      const msg = formatTripMessage({
        startTime: trip.startTime, endTime: updated.endTime, duration: updated.duration,
        distance: updated.distance, avgSpeed: updated.avgSpeed, maxSpeed: updated.maxSpeed,
        fuelConsumed: fuelConsumed, fuelPer100km: fuelPer100km
      })
      await sendWebhook(config.webhookUrl, msg).catch(() => {})
    }

    return NextResponse.json({
      tripId, distance: updated.distance, duration: updated.duration,
      avgSpeed: updated.avgSpeed, maxSpeed: updated.maxSpeed,
      fuelConsumed: fuelConsumed, fuelPer100km: fuelPer100km, state: 'FINISHED'
    })
  }

  // === UPLOAD POINTS ===
  if (action === 'upload-points') {
    const { tripId, points } = body
    if (!tripId || !Array.isArray(points) || points.length === 0) {
      return NextResponse.json({ error: 'tripId and points required' }, { status: 400 })
    }
    const existingTrip = await prisma.trip.findUnique({ where: { id: tripId } })
    if (!existingTrip || existingTrip.endTime) {
      return NextResponse.json({ error: 'Trip not found or ended' }, { status: 404 })
    }
    const newPoints = points.map(p => ({
      tripId, timestamp: new Date(p.timestamp), latitude: p.lat, longitude: p.lng,
      speed: p.speed || 0, altitude: p.altitude || null, bearing: p.bearing || null,
      fuelLevel: p.fuelLevel || null
    }))
    await prisma.gpsPoint.createMany({ data: newPoints })
    const totalCount = await prisma.gpsPoint.count({ where: { tripId } })
    return NextResponse.json({ uploaded: points.length, totalPoints: totalCount })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
