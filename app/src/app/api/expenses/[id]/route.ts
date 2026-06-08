import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkApiKey } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { attachments: true },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(expense)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await request.json()
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      category: data.category,
      amount: data.amount,
      date: new Date(data.date),
      odometer: data.odometer || null,
      description: data.description || null,
      note: data.note || null,
    },
  })
  return NextResponse.json(expense)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
