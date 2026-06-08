'use client'
import { useEffect, useState } from 'react'
import TripChart from '@/components/TripChart'
import FuelChart from '@/components/FuelChart'
import ConsumptionChart from '@/components/ConsumptionChart'
import TripList from '@/components/TripList'
import FuelLog from '@/components/FuelLog'

type Stats = { trips: number; distance: number; fuel: number; spent: number }
type Summary = { today: Stats; week: Stats; month: Stats; total: Stats }

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats/summary')
      .then(r => r.json()).then(d => { setSummary(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || !summary) {
    return <div className="flex items-center justify-center h-screen text-xl text-gray-400">加载中...</div>
  }

  const periods: (keyof Summary)[] = ['today', 'week', 'month', 'total']

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚗</span>
            <div><h1 className="text-xl font-bold text-gray-800">车行记</h1>
            <p className="text-xs text-gray-400">CarLog - 行驶记录与分析</p></div>
          </div>
          <div className="text-sm text-gray-400">{new Date().toLocaleDateString('zh-CN')}</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {periods.map(period => {
            const s = summary[period]
            const label = { today: '今日', week: '本周', month: '本月', total: '总计' }[period]
            return (
              <div key={period} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="text-xs text-gray-400 mb-2">{label}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-gray-400">里程</div>
                    <div className="text-lg font-bold text-blue-600">{s.distance}<span className="text-xs font-normal">km</span></div></div>
                  <div><div className="text-xs text-gray-400">加油</div>
                    <div className="text-lg font-bold text-green-600">{s.fuel}<span className="text-xs font-normal">L</span></div></div>
                  <div><div className="text-xs text-gray-400">行程</div>
                    <div className="text-lg font-bold text-purple-600">{s.trips}<span className="text-xs font-normal">次</span></div></div>
                  <div><div className="text-xs text-gray-400">花费</div>
                    <div className="text-lg font-bold text-orange-600">¥{s.spent}</div></div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Charts */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">📊 行驶里程趋势</h2>
          <TripChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">⛽ 加油记录趋势</h2>
            <FuelChart />
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">📉 百公里油耗趋势</h2>
            <ConsumptionChart />
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">🚙 最近行程</h2>
            <TripList limit={8} />
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">⛽ 最近加油</h2>
            <FuelLog limit={8} />
          </div>
        </div>
      </main>
    </div>
  )
}
