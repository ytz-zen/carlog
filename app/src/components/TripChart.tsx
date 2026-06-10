'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function TripChart({ carId }: { carId?: string | null }) {
  const [data, setData] = useState<{date: string; distance: number}[]>([])
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    const params = carId ? `&carId=${carId}` : ''
    fetch(`/api/dashboard/stats/trip-chart?granularity=day&period=${period}${params}`)
      .then(r => r.json()).then(d => {
        setData(d.labels.map((l: string, i: number) => ({ date: l, distance: d.distance[i] || 0 })))
      }).catch(() => setData([]))
  }, [period])

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['7d', '30d', '90d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-xs rounded-full ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p === '7d' ? '7天' : p === '30d' ? '30天' : '90天'}
          </button>
        ))}
      </div>
      {data.length === 0 ? <div className="h-48 flex items-center justify-center text-gray-400">暂无数据</div> : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickMargin={8} />
            <YAxis tick={{ fontSize: 11 }} tickMargin={8} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} formatter={(v: number) => [`${v} km`]} />
            <Line type="monotone" dataKey="distance" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
