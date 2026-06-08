import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkApiKey } from '@/lib/auth'

// GET: 获取里程/校正信息
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey || apiKey !== (process.env.API_KEY || 'carlog_dev_key_2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const car = await prisma.car.findFirst({
    include: {
      odometerEntries: { orderBy: { timestamp: 'desc' }, take: 10 },
    },
  })
  if (!car) return NextResponse.json({ error: 'No car' }, { status: 404 })

  // 计算当前表显 = initialOdometer + (总GPS里程 * calibrationFactor)
  const totalGps = await prisma.trip.aggregate({ _sum: { distance: true } })
  const gpsTotal = totalGps._sum.distance || 0
  const currentOdometer = car.initialOdometer != null
    ? car.initialOdometer + gpsTotal * car.calibrationFactor
    : null

  return NextResponse.json({
    initialOdometer: car.initialOdometer,
    calibrationFactor: car.calibrationFactor,
    currentOdometer: currentOdometer ? Math.round(currentOdometer * 10) / 10 : null,
    totalGpsDistance: Math.round(gpsTotal * 10) / 10,
    entries: car.odometerEntries,
  })
}

// POST: 设置表显或做校正
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey || apiKey !== (process.env.API_KEY || 'carlog_dev_key_2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const car = await prisma.car.findFirst()
  if (!car) return NextResponse.json({ error: 'No car' }, { status: 404 })

  // 首次录入表显
  if (body.action === 'init' && body.odometer != null) {
    await prisma.car.update({
      where: { id: car.id },
      data: { initialOdometer: body.odometer },
    })
    await prisma.odometerEntry.create({
      data: { carId: car.id, reading: body.odometer, source: 'manual' },
    })
    return NextResponse.json({ ok: true, initialOdometer: body.odometer })
  }

  // 校正：用户输入当前表显，系统计算校正系数
  if (body.action === 'calibrate' && body.currentOdometer != null && car.initialOdometer != null) {
    const actualDelta = body.currentOdometer - car.initialOdometer
    const totalGps = await prisma.trip.aggregate({ _sum: { distance: true } })
    const gpsTotal = totalGps._sum.distance || 0

    if (gpsTotal > 0) {
      const factor = Math.round((actualDelta / gpsTotal) * 10000) / 10000
      if (factor > 0 && factor < 5) { // 合理范围: 0.5x ~ 5x
        await prisma.car.update({
          where: { id: car.id },
          data: { calibrationFactor: factor },
        })
        await prisma.odometerEntry.create({
          data: { carId: car.id, reading: body.currentOdometer, source: 'manual' },
        })
        return NextResponse.json({ ok: true, calibrationFactor: factor })
      }
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
