import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '50')
  const carId = searchParams.get('carId') || undefined

  const where: Record<string, any> = {}
  if (carId) where.carId = carId

  const [events, total] = await Promise.all([
    prisma.fuelEvent.findMany({
      where, orderBy: { timestamp: 'desc' }, skip: (page-1)*size, take: size,
      include: { tank: { select: { capacity: true, name: true } } }
    }),
    prisma.fuelEvent.count({ where })
  ])

  return NextResponse.json({
    events: events.map(e => ({
      id: e.id, timestamp: e.timestamp, fuelBefore: e.fuelBefore, fuelAfter: e.fuelAfter,
      fuelAdded: e.fuelAdded, odometer: e.odometer, isManual: e.isManual,
      note: e.note, price: e.price, totalPrice: e.totalPrice
    })),
    total, page, pageSize: size
  })
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = await getApiKey()
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  if (action === 'auto') {
    const { tripId, fuelBefore, fuelAfter, odometer, timestamp } = body
    const tank = await prisma.tank.findFirst()
    if (!tank) return NextResponse.json({ error: 'No car configured' }, { status: 404 })
    let car = await prisma.car.findFirst()
    if (!car) car = await prisma.car.create({ data: { name: '我的车', tank: { create: { name: '主油箱', capacity: 60 } } } })
    const fuelAdded = Math.round(tank.capacity * (fuelAfter - fuelBefore) / 1000) / 10
    const ts = timestamp ? new Date(timestamp) : new Date()

    const event = await prisma.fuelEvent.create({
      data: { carId: car.id, tankId: tank.id, timestamp: ts, fuelBefore, fuelAfter, fuelAdded, odometer, tripId: tripId || null, isManual: false }
    })
    return NextResponse.json({ event: { id: event.id, timestamp: event.timestamp, fuelBefore: event.fuelBefore, fuelAfter: event.fuelAfter, fuelAdded: event.fuelAdded, odometer: event.odometer } })
  }

  if (action === 'manual') {
    const { fuelBefore, fuelAfter, fuelAdded, odometer, note, price, totalPrice, tripId } = body
    const tank = await prisma.tank.findFirst()
    if (!tank) return NextResponse.json({ error: 'No car configured' }, { status: 404 })
    let car = await prisma.car.findFirst()
    if (!car) car = await prisma.car.create({ data: { name: '我的车', tank: { create: { name: '主油箱', capacity: 60 } } } })
    const event = await prisma.fuelEvent.create({
      data: { carId: car.id, tankId: tank.id, timestamp: new Date(), fuelBefore, fuelAfter,
              fuelAdded: fuelAdded || Math.round(tank.capacity * (fuelAfter - fuelBefore) / 1000) / 10,
              odometer, tripId: tripId || null, isManual: true, note, price, totalPrice }
    })
    return NextResponse.json({ event })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
