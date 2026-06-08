import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWebhook, formatTripMessage } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || ''
  const validKey = process.env.API_KEY || 'carlog_secret_key'
  if (apiKey !== validKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tripId } = await request.json()
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { car: true } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = await prisma.notificationConfig.findFirst({ where: { carId: trip.carId, onTripEnd: true } })
  if (!config) return NextResponse.json({ message: 'No config' })

  const msg = formatTripMessage(trip)
  const ok = await sendWebhook(config.webhookUrl, msg)
  return NextResponse.json({ sent: ok })
}
