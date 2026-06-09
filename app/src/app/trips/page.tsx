'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Trip {
  id: string; startTime: string; endTime: string | null
  distance: number | null; duration: number | null
  avgSpeed: number | null; maxSpeed: number | null
  fuelConsumed: number | null; fuelPer100km: number | null
  tank: { name: string }
}

export default function TripsPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/trips?size=50', { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.json()).then(d => { setTrips(d.trips || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmt = (sec: number | null) => {
    if (!sec) return '-'
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
    return h > 0 ? `${h}时${m}分` : m > 0 ? `${m}分${s}秒` : `${s}秒`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-indigo-600 hover:text-indigo-800 text-lg">&larr;</button>
        <h1 className="text-lg font-semibold text-slate-800">🚗 行程记录</h1>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">加载中...</div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="text-4xl mb-3">🚗</div>
            <p className="text-slate-500">暂无行程记录</p>
            <p className="text-xs text-slate-400 mt-1">连接车辆后会自动记录行驶轨迹</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-slate-50 text-slate-400 text-xs">
                <th className="py-3 px-4 text-left">时间</th>
                <th className="py-3 px-4 text-right">里程</th>
                <th className="py-3 px-4 text-right">时长</th>
                <th className="py-3 px-4 text-right">均速</th>
                <th className="py-3 px-4 text-right">油耗</th>
                <th className="py-3 px-4 text-center">轨迹</th>
              </tr></thead>
              <tbody>
                {trips.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(t.startTime).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                      <span className="text-slate-300 ml-1">{new Date(t.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-indigo-600 font-medium">{t.distance !== null ? `${t.distance} km` : '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{t.duration !== null ? fmt(t.duration) : '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{t.avgSpeed !== null ? `${t.avgSpeed} km/h` : '-'}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{t.fuelConsumed !== null ? `${t.fuelConsumed} L` : '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <a href={`/trip/${t.id}`} className="text-indigo-500 hover:text-indigo-700 text-xs hover:underline">查看轨迹</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
