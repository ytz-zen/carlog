import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey || apiKey !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { carName } = await request.json()
  if (!carName) return NextResponse.json({ error: 'carName required' }, { status: 400 })
  
  let car = await prisma.car.findFirst({ where: { name: carName }, include: { tank: true } })
  if (!car) {
    car = await prisma.car.create({
      data: { name: carName, tank: { create: { name: '主油箱', capacity: 60 } }, isOnline: true, lastSeenAt: new Date() },
      include: { tank: true },
    })
  } else {
    car = await prisma.car.update({
      where: { id: car.id }, data: { isOnline: true, lastSeenAt: new Date() },
      include: { tank: true },
    })
  }
  
  return NextResponse.json({ carId: car.id, tankId: car.tank.id, name: car.name })
}
