'use client'
import { useEffect, useState } from 'react'

interface DailyFuel { date: string; avg: number }
interface RefuelEvent { date: string; before: number; after: number; added: number }

export default function FuelLevelChart() {
  const [data, setData] = useState<DailyFuel[]>([])
  const [refuels, setRefuels] = useState<RefuelEvent[]>([])
  const [period, setPeriod] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/dashboard/stats/fuel-level?period=${period}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(r.status + ''); return r.json() })
      .then(d => { setData(d.daily || []); setRefuels(d.refuelEvents || []) })
      .catch(e => setError(String(e)))
  }, [period])

  if (error) return <div className="text-center py-6 text-slate-400 text-sm">加载失败 ({error})</div>
  if (data.length === 0) return <div className="text-center py-6 text-slate-400 text-sm">暂无油量数据</div>

  // Simple inline chart
  const maxVal = Math.max(...data.map(d => d.avg), 100)
  const minVal = Math.min(...data.map(d => d.avg), 0)

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {[7, 14, 30, 90].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`text-xs px-2.5 py-1 rounded-full transition ${period === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {p}天
          </button>
        ))}
      </div>
      {/* Bar chart */}
      <div className="flex items-end gap-1 h-40">
        {data.map(d => {
          const pct = ((d.avg - minVal) / (maxVal - minVal)) * 100
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-emerald-100 rounded-t relative" style={{ height: `${Math.max(pct, 3)}%` }}>
                <div className="w-full bg-emerald-500 rounded-t absolute bottom-0" style={{ height: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-slate-400">{d.date.slice(5)}</span>
            </div>
          )
        })}
      </div>
      {refuels.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">⛽ 检测到加油事件：</p>
          <div className="flex flex-wrap gap-1.5">
            {refuels.map((r, i) => (
              <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                {r.date.slice(5)} {r.before}% → {r.after}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
