'use client'
import { useEffect, useState } from 'react'
import TripChart from '@/components/TripChart'
import FuelChart from '@/components/FuelChart'
import ConsumptionChart from '@/components/ConsumptionChart'
import TripList from '@/components/TripList'
import FuelLog from '@/components/FuelLog'
import FuelLevelChart from '@/components/FuelLevelChart'
import { useRouter, usePathname } from 'next/navigation'

type Stats = { trips: number; distance: number; fuel: number; spent: number }
type Summary = { today: Stats; week: Stats; month: Stats; total: Stats }

const NAV_ITEMS = [
  { href: '/', icon: '📊', label: '仪表盘' },
  { href: '/trips', icon: '🚗', label: '行程' },
  { href: '/expenses', icon: '💰', label: '费用' },
  { href: '/reminders', icon: '⏰', label: '提醒' },
  { href: '/cars', icon: '🚙', label: '车辆' },
]

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [odometer, setOdometer] = useState<{ initial: number | null; current: number | null; factor: number } | null>(null)
  const [showCalibrate, setShowCalibrate] = useState(false)
  const [calInput, setCalInput] = useState('')
  const [showInit, setShowInit] = useState(false)
  const [initInput, setInitInput] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/stats/summary')
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setSummary(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/config/odometer', { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.ok ? r.json() : null).then(d => {
        if (d) setOdometer({ initial: d.initialOdometer ?? null, current: d.currentOdometer ?? null, factor: d.calibrationFactor ?? 1 })
      })
      .catch(() => {})
  }, [])

  if (loading || !summary) {
    return <div className="flex items-center justify-center h-screen text-xl text-gray-400">加载中...</div>
  }

  const periods: (keyof Summary)[] = ['today', 'week', 'month', 'total']

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🚗 车行记</h1>
          <p>CarLog · 行驶记录</p>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href)
            return (
              <a key={item.href} href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}>
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <a href="/settings" className={`sidebar-link ${pathname === '/settings' ? 'active' : ''}`}>
            <span className="icon">⚙️</span>
            <span>设置</span>
          </a>
          <button onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }} className="sidebar-link" style={{ cursor: 'pointer', width: '100%' }}>
            <span className="icon">🚪</span>
            <span>退出</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">仪表盘</h2>
            <p className="text-xs text-slate-400">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <div className="flex items-center gap-3">
            {odometer && (
              <div className="text-xs text-slate-400 hidden sm:block">
                里程: <span className="font-mono font-medium text-slate-600">
                  {odometer.current !== null ? `${odometer.current.toLocaleString()} km` : '未设置'}
                </span>
              </div>
            )}
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Odometer Card */}
          {odometer && (
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">当前表显里程</div>
                    <div className="text-2xl font-bold text-slate-800">
                      {odometer.current !== null ? `${odometer.current.toLocaleString()} km` : '未设置'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 border-l border-slate-200 pl-4">
                    校正系数: {odometer.factor.toFixed(4)}<br/>
                    {odometer.initial !== null && `初始: ${odometer.initial} km`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!odometer.initial ? (
                    <button onClick={() => setShowInit(true)} className="btn btn-primary text-xs">录入初始表显</button>
                  ) : (
                    <button onClick={() => setShowCalibrate(true)} className="btn btn-ghost text-xs">校正</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {periods.map(period => {
              const s = summary[period]
              const label = { today: '今日', week: '本周', month: '本月', total: '总计' }[period]
              return (
                <div key={period} className="stat-card">
                  <div className="label">{label}</div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <div className="text-xs text-slate-400">里程</div>
                      <div className="value" style={{color: '#4f46e5'}}>{s.distance.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-0.5">km</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">油耗</div>
                      <div className="value" style={{color: '#059669'}}>{s.fuel.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-0.5">L</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">行程</div>
                      <div className="value" style={{color: '#7c3aed'}}>{s.trips}<span className="text-sm font-normal text-slate-400 ml-0.5">次</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">花费</div>
                      <div className="value" style={{color: '#ea580c'}}>¥{s.spent.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Charts */}
          <div className="chart-card">
            <h2>📊 行驶里程趋势</h2>
            <TripChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="chart-card">
              <h2>⛽ 加油记录趋势</h2>
              <FuelChart />
            </div>
            <div className="chart-card">
              <h2>📉 百公里油耗趋势</h2>
              <ConsumptionChart />
            </div>
            </div>

            <div className="chart-card">
              <h2>⛽ 油量变化趋势</h2>
              <FuelLevelChart />
            </div>

            {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="chart-card">
              <h2>🚙 最近行程</h2>
              <TripList limit={8} />
            </div>
            <div className="chart-card">
              <h2>⛽ 最近加油</h2>
              <FuelLog limit={8} />
            </div>
          </div>
        </div>
      </main>

      {/* Init Modal */}
      {showInit && (
        <div className="modal-overlay" onClick={() => setShowInit(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">录入初始里程</h3>
            <p className="text-sm text-slate-400 mb-4">查看仪表盘，输入当前总里程数</p>
            <input type="number" value={initInput} onChange={e => setInitInput(e.target.value)}
              className="input mb-4" placeholder="如 52340" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowInit(false)} className="btn btn-ghost flex-1">取消</button>
              <button onClick={async () => {
                await fetch('/api/config/odometer', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' },
                  body: JSON.stringify({ action: 'init', odometer: parseFloat(initInput) })
                })
                setShowInit(false); window.location.reload()
              }} className="btn btn-primary flex-1">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Calibrate Modal */}
      {showCalibrate && (
        <div className="modal-overlay" onClick={() => setShowCalibrate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">校正里程</h3>
            <p className="text-sm text-slate-400 mb-4">输入仪表盘当前实际里程数</p>
            <input type="number" value={calInput} onChange={e => setCalInput(e.target.value)}
              className="input mb-4" placeholder={`当前应约 ${odometer?.current?.toFixed(0)} km`} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowCalibrate(false)} className="btn btn-ghost flex-1">取消</button>
              <button onClick={async () => {
                const r = await fetch('/api/config/odometer', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' },
                  body: JSON.stringify({ action: 'calibrate', currentOdometer: parseFloat(calInput) })
                })
                const d = await r.json()
                if (d.ok) alert(`校正完成！系数: ${d.calibrationFactor}`)
                else alert('校正失败，请确保已录入初始里程')
                setShowCalibrate(false); window.location.reload()
              }} className="btn btn-primary flex-1">确认校正</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
