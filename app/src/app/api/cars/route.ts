import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkCookieAuth } from '@/lib/auth'

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
  await prisma.car.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
