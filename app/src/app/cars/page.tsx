'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Car {
  id: string; name: string; isOnline: boolean; lastSeenAt: string | null
  tank: { name: string; capacity: number }
  _count: { trips: number }
}

export default function CarsPage() {
  const router = useRouter()
  const [cars, setCars] = useState<Car[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const fetchCars = () => {
    fetch('/api/cars').then(r => r.json()).then(setCars)
  }
  useEffect(() => { fetchCars() }, [])

  const rename = async (id: string) => {
    await fetch('/api/cars', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, name: editName }),
    })
    setEditId(null); fetchCars()
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除该车辆及所有数据？')) return
    await fetch('/api/cars', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    fetchCars()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-blue-600 hover:text-blue-800">&larr;</button>
        <span className="text-2xl">🚗</span>
        <h1 className="text-lg font-bold text-gray-800">车辆管理</h1>
      </header>
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {cars.map(car => (
          <div key={car.id} className="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${car.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div>
                {editId === car.id ? (
                  <div className="flex gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="border rounded px-2 py-1 text-sm" autoFocus
                      onKeyDown={e => e.key === 'Enter' && rename(car.id)} />
                    <button onClick={() => rename(car.id)} className="text-blue-600 text-xs">确定</button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 text-xs">取消</button>
                  </div>
                ) : (
                  <>
                    <div className="font-semibold text-gray-800">{car.name}</div>
                    <div className="text-xs text-gray-400">
                      {car.isOnline ? '在线' : '离线'}
                      {car.lastSeenAt && ` · ${new Date(car.lastSeenAt).toLocaleString('zh-CN')}`}
                      · {car._count.trips} 次行程 · {car.tank.capacity}L
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditId(car.id); setEditName(car.name) }}
                className="text-xs text-blue-600 hover:underline">重命名</button>
              <button onClick={() => remove(car.id)}
                className="text-xs text-red-500 hover:underline">删除</button>
            </div>
          </div>
        ))}
        {cars.length === 0 && <div className="text-center py-12 text-gray-400">暂无车辆，Android 端首次连接时会自动创建</div>}
      </main>
    </div>
  )
}
