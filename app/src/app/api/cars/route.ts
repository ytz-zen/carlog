import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkCookieAuth, getApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey || apiKey !== (await getApiKey()))
    if (!await checkCookieAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const cars = await prisma.car.findMany({
    include: { tank: { select: { name: true, capacity: true } }, _count: { select: { trips: true } } },
    orderBy: { lastSeenAt: 'desc' },
  })
  
  // Mark offline if >5 min no signal
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  for (const car of cars) {
    if (car.isOnline && car.lastSeenAt && car.lastSeenAt < fiveMinAgo) {
      await prisma.car.update({ where: { id: car.id }, data: { isOnline: false } })
      car.isOnline = false
    }
  }
  
  return NextResponse.json(cars)
}

export async function PUT(request: NextRequest) {
  if (!await checkCookieAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name } = await request.json()
  if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 })
  await prisma.car.update({ where: { id }, data: { name } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!await checkCookieAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // 1. 先获取该 car 的 tankId（Tank 的 FK 在 Car 上）
  const car = await prisma.car.findUnique({ where: { id }, select: { tankId: true } })
  if (!car) return NextResponse.json({ error: 'Car not found' }, { status: 404 })
  // 2. 按 carId 精确删除关联数据（不影响同名车辆）
  await prisma.trip.deleteMany({ where: { carId: id } })
  await prisma.fuelEvent.deleteMany({ where: { carId: id } })
  await prisma.odometerEntry.deleteMany({ where: { carId: id } })
  await prisma.expense.deleteMany({ where: { carId: id } })
  await prisma.reminder.deleteMany({ where: { carId: id } })
  // 3. 删除关联的 tank
  await prisma.tank.deleteMany({ where: { id: car.tankId } })
  // 4. 删除 car（notificationConfig 有 carId @unique，自动级联删除）
  await prisma.car.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
