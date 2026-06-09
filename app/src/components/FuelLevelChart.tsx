'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface DailyFuel {
  date: string; avg: number; min: number; max: number
}
interface RefuelEvent {
  date: string; before: number; after: number; added: number
}

export default function FuelLevelChart() {
  const [data, setData] = useState<DailyFuel[]>([])
  const [refuels, setRefuels] = useState<RefuelEvent[]>([])
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    fetch(`/api/dashboard/stats/fuel-level?period=${period}`)
      .then(r => r.json()).then(d => { setData(d.daily || []); setRefuels(d.refuelEvents || []) })
      .catch(() => {})
  }, [period])

  if (data.length === 0) return <div className="text-center py-8 text-slate-400 text-sm">暂无油量数据（连接 OBD 后自动记录）</div>

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
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Line type="monotone" dataKey="avg" stroke="#059669" strokeWidth={2} dot={false} name="平均油量" />
          <Line type="monotone" dataKey="min" stroke="#f59e0b" strokeWidth={1} dot={false} name="最低" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="max" stroke="#10b981" strokeWidth={1} dot={false} name="最高" strokeDasharray="4 4" />
          <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '低油量', position: 'right', fontSize: 10, fill: '#ef4444' }} />
        </LineChart>
      </ResponsiveContainer>
      {refuels.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">⛽ 检测到加油事件：</p>
          <div className="flex flex-wrap gap-1.5">
            {refuels.map((r, i) => (
              <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                {r.date.slice(5)} {r.before}% → {r.after}% (+{r.added}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
