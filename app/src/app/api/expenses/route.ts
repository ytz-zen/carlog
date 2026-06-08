import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || undefined
  const search = searchParams.get('search') || undefined
  const start = searchParams.get('start') || undefined
  const end = searchParams.get('end') || undefined
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')
  const sortBy = searchParams.get('sortBy') || 'date'
  const sortDir = searchParams.get('sortDir') || 'desc'

  const where: any = {}
  if (category) where.category = category
  if (search) where.OR = [
    { description: { contains: search } },
    { note: { contains: search } },
  ]
  if (start || end) {
    where.date = {}
    if (start) where.date.gte = new Date(start)
    if (end) where.date.lte = new Date(end)
  }

  const [total, expenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * size,
      take: size,
      include: { attachments: { select: { id: true, filename: true, size: true, mimetype: true } } },
    }),
  ])

  return NextResponse.json({ total, page, size, totalPages: Math.ceil(total / size), expenses })
}

export async function POST(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await request.json()
  const car = await prisma.car.findFirst()
  if (!car) return NextResponse.json({ error: 'No car' }, { status: 400 })

  const expense = await prisma.expense.create({
    data: {
      carId: car.id,
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
