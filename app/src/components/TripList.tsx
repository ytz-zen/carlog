'use client'
import { useEffect, useState } from 'react'

interface Trip {
  id: string; startTime: string; endTime: string | null; duration: number | null
  distance: number | null; avgSpeed: number | null; maxSpeed: number | null
  fuelConsumed: number | null; fuelPer100km: number | null; tankName: string
}

export default function TripList({ limit = 20 }: { limit?: number }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/dashboard/trips?size=${limit}`)
      .then(r => r.json()).then(d => { setTrips(d.trips || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [limit])

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>
  if (trips.length === 0) return <div className="text-center py-8 text-gray-400">暂无行程记录</div>

  const fmt = (sec: number | null) => {
    if (!sec) return '-'
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
    return h > 0 ? `${h}时${m}分${s}秒` : m > 0 ? `${m}分${s}秒` : `${s}秒`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-gray-400 text-xs">
          <th className="py-2 text-left">时间</th>
          <th className="py-2 text-right">里程</th>
          <th className="py-2 text-right">时长</th>
          <th className="py-2 text-right">均速</th>
          <th className="py-2 text-right">油耗</th>
        </tr></thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-2.5 text-gray-600">
                {new Date(t.startTime).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' })}
                <span className="text-xs text-gray-300 ml-1">{new Date(t.startTime).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}</span>
              </td>
              <td className="py-2.5 text-right text-blue-600 font-medium">{t.distance !== null ? `${t.distance} km` : '-'}</td>
              <td className="py-2.5 text-right text-gray-600">{t.duration !== null ? fmt(t.duration) : '-'}</td>
              <td className="py-2.5 text-right text-gray-600">{t.avgSpeed !== null ? `${t.avgSpeed} km/h` : '-'}</td>
              <td className="py-2.5 text-right text-green-600">{t.fuelPer100km !== null ? `${t.fuelPer100km} L` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
