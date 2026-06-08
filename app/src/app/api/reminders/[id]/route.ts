import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params; const r = await prisma.reminder.findUnique({ where: { id } })
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(r)
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params; const data = await request.json()
  let nextDate = data.nextDate ? new Date(data.nextDate) : undefined
  let nextOdo = data.nextOdometer ? parseFloat(data.nextOdometer) : undefined
  if (data.lastDate && data.intervalDays) {
    const d = new Date(data.lastDate); d.setDate(d.getDate() + parseInt(data.intervalDays)); nextDate = d
  }
  if (data.lastOdometer && data.intervalKm) { nextOdo = parseFloat(data.lastOdometer) + parseFloat(data.intervalKm) }
  const r = await prisma.reminder.update({ where: { id },
    data: { title: data.title, category: data.category, remindType: data.remindType,
      intervalDays: data.intervalDays ? parseInt(data.intervalDays) : null,
      intervalKm: data.intervalKm ? parseFloat(data.intervalKm) : null,
      lastDate: data.lastDate ? new Date(data.lastDate) : null,
      lastOdometer: data.lastOdometer ? parseFloat(data.lastOdometer) : null,
      nextDate, nextOdometer: nextOdo, enabled: data.enabled } })
  return NextResponse.json(r)
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params; await prisma.reminder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}