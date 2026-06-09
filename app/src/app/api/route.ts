import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (await getApiKey()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = parseInt(searchParams.get('period') || '30')
  const startDate = new Date(Date.now() - period * 86400000)

  const byCategory = await prisma.expense.groupBy({
    by: ['category'], _sum: { amount: true }, _count: true,
    where: { date: { gte: startDate } },
    orderBy: { _sum: { amount: 'desc' } },
  })

  const byMonth = await prisma.$queryRaw<{ month: string; total: number }[]>`
    SELECT to_char(date, 'YYYY-MM') as month, SUM(amount) as total
    FROM "Expense" WHERE date >= ${startDate}
    GROUP BY month ORDER BY month ASC
  `

  const allTime = await prisma.expense.aggregate({ _sum: { amount: true }, _count: true })
  const periodSum = await prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate } } })
  const topCategory = byCategory[0] || null

  return NextResponse.json({
    allTime: allTime._sum.amount || 0, allCount: allTime._count,
    periodTotal: periodSum._sum.amount || 0,
    byCategory: byCategory.map(c => ({ category: c.category, total: c._sum.amount || 0, count: c._count })),
    byMonth: byMonth.map(m => ({ month: m.month, total: Number(m.total) })),
    topCategory: topCategory ? { category: topCategory.category, total: topCategory._sum.amount || 0 } : null,
  })
}
