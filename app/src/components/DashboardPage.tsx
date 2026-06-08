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
  const [odometer, setOdometer] = useState<{ initial: number | null; current: number | null; factor: number } | null>(null)
  const [showCalibrate, setShowCalibrate] = useState(false)
  const [calInput, setCalInput] = useState('')
  const [showInit, setShowInit] = useState(false)
  const [initInput, setInitInput] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/stats/summary')
      .then(r => r.json()).then(d => { setSummary(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/config/odometer', { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.json()).then(d => setOdometer({ initial: d.initialOdometer, current: d.currentOdometer, factor: d.calibrationFactor }))
      .catch(() => {})
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
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">{new Date().toLocaleDateString('zh-CN')}</div>
            <a href="/expenses" className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50 transition">💰 费用管理</a>
            <a href="/reminders" className="text-sm text-orange-600 hover:text-orange-800 border border-orange-200 rounded px-3 py-1 hover:bg-orange-50 transition">⏰ 提醒</a>
            <button onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/login'
            }} className="text-sm text-red-500 hover:text-red-700 border border-red-200 rounded px-3 py-1 hover:bg-red-50 transition">
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* 里程表 & 校正 */}
      {odometer && (
        <div className="max-w-7xl mx-auto px-4 pt-2">
          <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-gray-400">当前表显里程</div>
                <div className="text-2xl font-bold text-gray-800">
                  {odometer.current !== null ? `${odometer.current.toLocaleString()} km` : '未设置'}
                </div>
              </div>
              <div className="text-xs text-gray-400 border-l pl-4">
                校正系数: {odometer.factor.toFixed(4)}<br/>
                {odometer.initial !== null && `初始录入: ${odometer.initial} km`}
              </div>
            </div>
            <div className="flex gap-2">
              {!odometer.initial ? (
                <button onClick={() => setShowInit(true)}
                  className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 transition">
                  录入初始表显
                </button>
              ) : (
                <button onClick={() => setShowCalibrate(true)}
                  className="text-xs border border-blue-300 text-blue-600 rounded px-3 py-1.5 hover:bg-blue-50 transition">
                  校正
                </button>
              )}
            </div>
          </div>
          {/* 录入弹窗 */}
          {showInit && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowInit(false)}>
              <div className="bg-white rounded-xl p-6 shadow-lg w-80" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold mb-3">录入初始里程</h3>
                <p className="text-xs text-gray-400 mb-3">查看仪表盘，输入当前总里程数（公里）</p>
                <input type="number" value={initInput} onChange={e => setInitInput(e.target.value)}
                  className="w-full border rounded px-3 py-2 mb-3" placeholder="如 52340" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => setShowInit(false)} className="flex-1 border rounded py-2 text-sm">取消</button>
                  <button onClick={async () => {
                    await fetch('/api/config/odometer', {
                      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' },
                      body: JSON.stringify({ action: 'init', odometer: parseFloat(initInput) })
                    })
                    setShowInit(false); window.location.reload()
                  }} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm">确认</button>
                </div>
              </div>
            </div>
          )}
          {/* 校正弹窗 */}
          {showCalibrate && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCalibrate(false)}>
              <div className="bg-white rounded-xl p-6 shadow-lg w-80" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold mb-3">校正里程</h3>
                <p className="text-xs text-gray-400 mb-3">查看仪表盘当前总里程，输入实际数值。</p>
                <input type="number" value={calInput} onChange={e => setCalInput(e.target.value)}
                  className="w-full border rounded px-3 py-2 mb-3" placeholder={`当前应约 ${odometer?.current?.toFixed(0)} km`} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => setShowCalibrate(false)} className="flex-1 border rounded py-2 text-sm">取消</button>
                  <button onClick={async () => {
                    const r = await fetch('/api/config/odometer', {
                      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' },
                      body: JSON.stringify({ action: 'calibrate', currentOdometer: parseFloat(calInput) })
                    })
                    const d = await r.json()
                    if (d.ok) alert(`校正完成！系数: ${d.calibrationFactor}`)
                    else alert('校正失败，请确保已录入初始里程且有行驶数据')
                    setShowCalibrate(false); window.location.reload()
                  }} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm">确认校正</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
