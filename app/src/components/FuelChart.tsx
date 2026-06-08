'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function FuelChart() {
  const [data, setData] = useState<{date: string; fuel: number; cost: number}[]>([])
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    fetch(`/api/dashboard/stats/fuel-chart?granularity=day&period=${period}`)
      .then(r => r.json()).then(d => {
        setData(d.labels.map((l: string, i: number) => ({ date: l, fuel: d.fuelAdded[i] || 0, cost: d.totalPrice[i] || 0 })))
      }).catch(() => setData([]))
  }, [period])

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['7d', '30d', '90d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-xs rounded-full ${period === p ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p === '7d' ? '7天' : p === '30d' ? '30天' : '90天'}
          </button>
        ))}
      </div>
      {data.length === 0 ? <div className="h-48 flex items-center justify-center text-gray-400">暂无数据</div> : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickMargin={8} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickMargin={8} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickMargin={8} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
            <Line yAxisId="left" type="monotone" dataKey="fuel" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="加油量(L)" />
            <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="花费(¥)" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
