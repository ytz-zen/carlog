'use client'
import { useEffect, useState } from 'react'

interface Trip {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  distance: number | null
  avgSpeed: number | null
  maxSpeed: number | null
  carName: string
}

export default function TripHistoryTable({ carId }: { carId: string | null }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = carId ? `?carId=${carId}` : ''
    fetch(`/api/dashboard/trips?size=20${params}`)
      .then(r => r.json()).then(d => {
        setTrips(d.trips || [])
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [carId])

  if (loading) return <div className="text-center py-6 text-slate-400">加载中...</div>
  if (trips.length === 0) return <div className="text-center py-6 text-slate-400">暂无历史行程</div>

  const fmt = (sec: number | null) => {
    if (!sec) return '-'
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
    if (h > 0) return `${h}时${m}分${s}秒`
    if (m > 0) return `${m}分${s}秒`
    return `${s}秒`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-400 text-xs">
            <th className="py-2.5 text-left">开始时间</th>
            <th className="py-2.5 text-left">结束时间</th>
            <th className="py-2.5 text-right">行驶时间</th>
            <th className="py-2.5 text-right">距离</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="py-2.5 text-slate-600">
                {new Date(t.startTime).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' })}
                <span className="text-xs text-slate-300 ml-1">{new Date(t.startTime).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}</span>
              </td>
              <td className="py-2.5 text-slate-600">
                {t.endTime ? (
                  <>
                    {new Date(t.endTime).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' })}
                    <span className="text-xs text-slate-300 ml-1">{new Date(t.endTime).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}</span>
                  </>
                ) : '进行中'}
              </td>
              <td className="py-2.5 text-right text-slate-600">{fmt(t.duration)}</td>
              <td className="py-2.5 text-right text-indigo-600 font-medium">
                {t.distance !== null ? `${t.distance} km` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
