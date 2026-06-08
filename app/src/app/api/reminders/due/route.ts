import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export async function GET(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  // Get current odometer from car
  const car = await prisma.car.findFirst({ include: { odometerEntries: { orderBy: { timestamp: 'desc' }, take: 1 } } })
  const currentKm = car?.initialOdometer
    ? car.initialOdometer + ((await prisma.trip.aggregate({ _sum: { distance: true } }))._sum.distance || 0) * car.calibrationFactor
    : null
  const reminders = await prisma.reminder.findMany({ where: { enabled: true }, orderBy: [{ nextDate: 'asc' }, { nextOdometer: 'asc' }] })
  const enriched = reminders.map(r => {
    let status = 'ok', daysLeft = null, kmLeft = null
    if (r.nextDate) {
      daysLeft = Math.ceil((r.nextDate.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 0) status = 'overdue'
      else if (daysLeft <= 14) status = 'soon'
    }
    if (r.nextOdometer && currentKm) {
      kmLeft = Math.round(r.nextOdometer - currentKm)
      if (kmLeft <= 0 && status !== 'overdue') status = 'overdue'
      else if (kmLeft <= 500 && status === 'ok') status = 'soon'
    }
    return { ...r, status, daysLeft, kmLeft, currentKm }
  })
  // Sort: overdue first, then soon, then ok
  enriched.sort((a, b) => { const order = { overdue: 0, soon: 1, ok: 2 }; return order[a.status] - order[b.status] })
  return NextResponse.json(enriched)
}