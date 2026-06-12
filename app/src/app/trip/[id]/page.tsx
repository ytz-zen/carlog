'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// 动态导入 Leaflet，避免 SSR 时引用 window
const LeafletInit = dynamic(
  () => import('@/lib/leaflet-init').catch(() => ({})),
  { ssr: false }
)

interface GpsPoint {
  lat: number
  lng: number
  speed: number
  timestamp: number
}

interface TripDetail {
  id: string
  startTime: string
  endTime: string
  duration: number
  distance: number
  avgSpeed: number
  maxSpeed: number
  fuelConsumed: number
  fuelPer100km: number
  points: GpsPoint[]
}

// Dynamic map component to avoid SSR window reference
const TripMap = dynamic(() => import('@/components/TripMap'), { ssr: false })

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [tripDetail, setTripDetail] = useState<{ trip: TripDetail; points: GpsPoint[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = params.id as string
    fetch(`/api/dashboard/trips/${id}`)
      .then(r => r.json()).then(d => { setTripDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params.id])

  // API 返回 { trip: {...}, points: [...] }，解包出来
  const apiTrip = tripDetail?.trip ?? null
  const apiPoints = tripDetail?.points ?? []
  const [tk, setTk] = useState('')

  useEffect(() => {
    fetch('/api/config/tianditu')
      .then(r => r.json()).then(d => setTk(d.key || ''))
      .catch(() => {})
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (!apiTrip) return <div className="min-h-screen flex items-center justify-center text-red-500">行程不存在</div>

  const fmtDist = (d: number) => d > 100 ? `${(d/1000).toFixed(1)}km` : `${d.toFixed(1)}km`
  const fmtDur = (s: number) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 text-lg">&larr; 返回</button>
        <h1 className="text-lg font-bold text-gray-800">行程详情</h1>
      </header>
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['里程', fmtDist(apiTrip.distance || 0), 'text-blue-600'],
            ['时长', fmtDur(apiTrip.duration || 0), 'text-green-600'],
            ['均速', `${apiTrip.avgSpeed?.toFixed(1) || '0'} km/h`, 'text-purple-600'],
            ['最高速', `${apiTrip.maxSpeed?.toFixed(1) || '0'} km/h`, 'text-orange-600'],
            ['耗油', `${apiTrip.fuelConsumed?.toFixed(1) || '0'} L`, 'text-amber-600'],
            ['百公里油耗', `${apiTrip.fuelPer100km?.toFixed(1) || '-'} L`, 'text-red-600'],
            ['时间', apiTrip.startTime ? new Date(apiTrip.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-', 'text-gray-600'],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="text-xs text-gray-400">{label}</div>
              <div className={`text-lg font-bold ${color}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-3 border-b text-sm font-semibold text-gray-700">🗺️ 行驶轨迹</div>
          <TripMap points={apiPoints} tk={tk} />
          {(!apiPoints || apiPoints.length === 0) && (
            <div className="p-12 text-center text-gray-400">暂无轨迹数据</div>
          )}
        </div>
      </main>
    </div>
  )
}
