/**
 * WeChat webhook notification service
 */

import { prisma } from '@/lib/db'
import { formatDuration } from '@/lib/utils'

export async function sendWebhook(webhookUrl: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content } })
    })
    const result = await res.json()
    return result.errcode === 0
  } catch (e) {
    console.error('Webhook send failed:', e)
    return false
  }
}

export function formatTripMessage(trip: {
  startTime: Date
  endTime: Date | null
  duration: number | null
  distance: number | null
  avgSpeed: number | null
  maxSpeed: number | null
  fuelConsumed: number | null
  fuelPer100km: number | null
}): string {
  const startTime = new Date(trip.startTime)
  const dur = trip.duration ? formatDuration(trip.duration) : '-'
  const dist = trip.distance !== null ? `${trip.distance} km` : '-'
  const avgSpd = trip.avgSpeed !== null ? `${trip.avgSpeed} km/h` : '-'
  const maxSpd = trip.maxSpeed !== null ? `${trip.maxSpeed} km/h` : '-'
  const fuel = trip.fuelConsumed !== null ? `${trip.fuelConsumed} L` : '-'
  const consumption = trip.fuelPer100km !== null ? `${trip.fuelPer100km} L/100km` : '-'

  return [
    `🚗 行程结束 [${startTime.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}]`,
    `里程: ${dist}  时长: ${dur}`,
    `均速: ${avgSpd}  最高: ${maxSpd}`,
    `油耗: ${fuel}  百公里: ${consumption}`
  ].join('\n')
}

export async function formatDailyDigest(date: Date): Promise<string> {
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999)

  const [trips, fuelEvents] = await Promise.all([
    prisma.trip.findMany({
      where: { startTime: { gte: startOfDay, lte: endOfDay } },
      select: { distance: true, duration: true, avgSpeed: true, maxSpeed: true, fuelConsumed: true, fuelPer100km: true }
    }),
    prisma.fuelEvent.findMany({
      where: { timestamp: { gte: startOfDay, lte: endOfDay } },
      select: { fuelAdded: true, totalPrice: true }
    })
  ])

  const totalDistance = trips.reduce((s, t) => s + (t.distance || 0), 0)
  const totalDuration = trips.reduce((s, t) => s + (t.duration || 0), 0)
  const totalFuel = trips.reduce((s, t) => s + (t.fuelConsumed || 0), 0)
  const totalSpent = fuelEvents.reduce((s, e) => s + (e.totalPrice || 0), 0)
  const totalRefueled = fuelEvents.reduce((s, e) => s + (e.fuelAdded || 0), 0)
  const avgConsumption = totalDistance > 0 ? (totalFuel / totalDistance * 100) : 0
  const avgSpd = trips.length > 0 ? trips.reduce((s, t) => s + (t.avgSpeed || 0), 0) / trips.length : 0

  const dateStr = date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'long' })

  return [
    `📊 每日驾驶汇总 [${dateStr}]`,
    ``,
    `行程: ${trips.length} 次  总里程: ${Math.round(totalDistance * 10) / 10} km`,
    `总时长: ${formatDuration(totalDuration)}`,
    `平均速度: ${Math.round(avgSpd)} km/h`,
    ``,
    `本次油耗: ${Math.round(totalFuel * 10) / 10} L`,
    `百公里油耗: ${Math.round(avgConsumption * 10) / 10} L/100km`,
    ``,
    `加油: ${Math.round(totalRefueled * 10) / 10} L  花费: ¥${Math.round(totalSpent * 100) / 100}`
  ].join('\n')
}
