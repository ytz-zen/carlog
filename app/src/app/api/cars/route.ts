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
  try {
    await prisma.$transaction(async (tx) => {
      // 1. 删除所有子表（Trip 和 FuelEvent 关联了 Tank，需先删）
      await tx.trip.deleteMany({ where: { carId: id } })
      await tx.fuelEvent.deleteMany({ where: { carId: id } })
      await tx.odometerEntry.deleteMany({ where: { carId: id } })
      await tx.expense.deleteMany({ where: { carId: id } })
      await tx.reminder.deleteMany({ where: { carId: id } })
      
      // 2. 获取 tankId
      const car = await tx.car.findUnique({ where: { id }, select: { tankId: true } })
      if (!car) throw new Error('Car not found')
      
      // 3. 删除 tank
      if (car.tankId) {
        await tx.tank.delete({ where: { id: car.tankId } })
      }
      
      // 4. 删除 car（notifConfig/AndroidLog 通过 onDelete: Cascade 自动删除）
      await tx.car.delete({ where: { id } })
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/cars] Error deleting car:', err)
    return NextResponse.json(
      { error: 'Failed to delete car: ' + (err.message || String(err)) },
      { status: 500 }
    )
  }
}
