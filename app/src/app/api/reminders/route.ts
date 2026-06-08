import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export async function GET(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const reminders = await prisma.reminder.findMany({ orderBy: [{ nextDate: 'asc' }, { nextOdometer: 'asc' }] })
  return NextResponse.json(reminders)
}
export async function POST(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await request.json()
  const car = await prisma.car.findFirst()
  if (!car) return NextResponse.json({ error: 'No car' }, { status: 400 })
  // calc nextDate / nextOdometer
  let nextDate = data.nextDate ? new Date(data.nextDate) : null
  let nextOdo = data.nextOdometer ? parseFloat(data.nextOdometer) : null
  if (data.lastDate && data.intervalDays) {
    const d = new Date(data.lastDate)
    d.setDate(d.getDate() + parseInt(data.intervalDays))
    nextDate = d
  }
  if (data.lastOdometer && data.intervalKm) {
    nextOdo = parseFloat(data.lastOdometer) + parseFloat(data.intervalKm)
  }
  const reminder = await prisma.reminder.create({
    data: { carId: car.id, title: data.title, category: data.category || 'other',
      remindType: data.remindType || 'time', intervalDays: data.intervalDays ? parseInt(data.intervalDays) : null,
      intervalKm: data.intervalKm ? parseFloat(data.intervalKm) : null,
      lastDate: data.lastDate ? new Date(data.lastDate) : null,
      lastOdometer: data.lastOdometer ? parseFloat(data.lastOdometer) : null,
      nextDate, nextOdometer: nextOdo, enabled: data.enabled !== false },
  })
  return NextResponse.json(reminder)
}