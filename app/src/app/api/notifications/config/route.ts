import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWebhook, formatDailyDigest } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.notificationConfig.findFirst({ include: { car: { select: { name: true } } } })
  if (!config) return NextResponse.json({ message: 'Not configured' }, { status: 404 })

  return NextResponse.json({
    webhookUrl: config.webhookUrl, onTripEnd: config.onTripEnd,
    dailyDigest: config.dailyDigest, dailyTime: config.dailyTime,
    showDistance: config.showDistance, showFuel: config.showFuel,
    showAvgSpeed: config.showAvgSpeed, showMaxSpeed: config.showMaxSpeed
  })
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  let car = await prisma.car.findFirst()
  if (!car) car = await prisma.car.create({ data: { name: '我的车', tank: { create: { name: '主油箱', capacity: 60 } } } })

  const config = await prisma.notificationConfig.upsert({
    where: { carId: car.id },
    create: { carId: car.id, webhookUrl: body.webhookUrl, onTripEnd: body.onTripEnd ?? true, dailyDigest: body.dailyDigest ?? true, dailyTime: body.dailyTime || '11:00' },
    update: { webhookUrl: body.webhookUrl, onTripEnd: body.onTripEnd ?? true, dailyDigest: body.dailyDigest ?? true, dailyTime: body.dailyTime || '11:00' }
  })

  return NextResponse.json({ success: true, id: config.id })
}
