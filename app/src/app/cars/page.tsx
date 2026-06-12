'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
    try {
      const res = await fetch('/api/cars', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('删除失败：' + (data.error || '未知错误'))
        return
      }
      fetchCars()
    } catch (err: any) {
      alert('删除失败：' + err.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-indigo-600 hover:text-indigo-800">&larr;</button>
        <span className="text-2xl">🚗</span>
        <h1 className="text-lg font-semibold text-slate-800">车辆管理</h1>
      </header>
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-3">
        {cars.map(car => (
          <div key={car.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${car.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div>
                {editId === car.id ? (
                  <div className="flex gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm" autoFocus
                      onKeyDown={e => e.key === 'Enter' && rename(car.id)} />
                    <button onClick={() => rename(car.id)} className="text-indigo-600 text-xs">确定</button>
                    <button onClick={() => setEditId(null)} className="text-slate-400 text-xs">取消</button>
                  </div>
                ) : (
                  <>
                    <div className="font-semibold text-slate-800">{car.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
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
                className="btn btn-ghost text-xs">重命名</button>
              <button onClick={() => remove(car.id)}
                className="btn btn-ghost text-xs text-red-500">删除</button>
            </div>
          </div>
        ))}
        {cars.length === 0 && <div className="text-center py-12 text-slate-400">暂无车辆，Android 端首次连接时会自动创建</div>}
      </main>
    </div>
  )
}

interface Car {
  id: string; name: string; isOnline: boolean; lastSeenAt: string | null
  tank: { name: string; capacity: number }
  _count: { trips: number }
}
