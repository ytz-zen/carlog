'use client'
import { useEffect, useState } from 'react'

interface FuelEvent {
  id: string; timestamp: string; fuelBefore: number; fuelAfter: number
  fuelAdded: number; odometer: number | null; isManual: boolean; note: string | null; totalPrice: number | null
}

export default function FuelLog({ limit = 20 }: { limit?: number }) {
  const [events, setEvents] = useState<FuelEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/fuel?size=${limit}`)
      .then(r => r.json()).then(d => { setEvents(d.events || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [limit])

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>
  if (events.length === 0) return <div className="text-center py-8 text-gray-400">暂无加油记录</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-gray-400 text-xs">
          <th className="py-2 text-left">日期</th>
          <th className="py-2 text-right">油量</th>
          <th className="py-2 text-right">加油</th>
          <th className="py-2 text-right">花费</th>
          <th className="py-2 text-left">备注</th>
        </tr></thead>
        <tbody>
          {events.map(e => (
            <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-2.5 text-gray-600">
                {new Date(e.timestamp).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' })}
                <span className="text-xs text-gray-300 ml-1">{new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}</span>
              </td>
              <td className="py-2.5 text-right text-gray-600">{e.fuelBefore}%→{e.fuelAfter}%</td>
              <td className="py-2.5 text-right text-green-600 font-medium">{e.fuelAdded} L</td>
              <td className="py-2.5 text-right text-orange-600">{e.totalPrice !== null ? `¥${e.totalPrice}` : '-'}</td>
              <td className="py-2.5 text-gray-400">{e.note || (e.isManual ? '手动' : '自动')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
