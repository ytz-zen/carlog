'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function ConsumptionChart({ carId }: { carId?: string | null }) {
  const [data, setData] = useState<{date: string; per100km: number | null}[]>([])

  useEffect(() => {
    fetch('/api/dashboard/stats/consumption-chart?period=30')
      .then(r => r.json()).then(d => {
        setData((d.data || []).map((item: any) => ({ date: item.date, per100km: item.per100km })))
      }).catch(() => setData([]))
  }, [])

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400">暂无油耗数据（需要完成行程且有加油记录）</div>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickMargin={8} />
        <YAxis tick={{ fontSize: 11 }} tickMargin={8} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} formatter={(v: number) => [`${v} L/100km`]} />
        <Line type="monotone" dataKey="per100km" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
