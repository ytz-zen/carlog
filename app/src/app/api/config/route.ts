import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let tank = await prisma.tank.findFirst({ include: { car: true } })
  if (!tank) {
    const car = await prisma.car.create({
      data: { name: '我的车', tank: { create: { name: '主油箱', capacity: 60 } } }
    })
    tank = await prisma.tank.findFirst({ include: { car: true } })
  }

  return NextResponse.json({
    tankCapacity: tank.capacity, tankName: tank.name,
    collectionInterval: 5, oilThreshold: 10,
    carId: tank.car.id
  })
}

export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  await prisma.tank.updateMany({
    where: {}, data: {
      ...(body.tankCapacity !== undefined && { capacity: body.tankCapacity }),
      ...(body.tankName !== undefined && { name: body.tankName })
    }
  })
  return NextResponse.json({ success: true })
}
