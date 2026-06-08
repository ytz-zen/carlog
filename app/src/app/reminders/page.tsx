'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const REMINDER_CATS: Record<string, string> = {
  maintenance: '🔧 保养', insurance: '🛡️ 保险', inspection: '📋 年检',
  tire: '🛞 轮胎', other: '📌 其他',
}

interface Reminder {
  id: string; title: string; category: string; remindType: string
  intervalDays: number | null; intervalKm: number | null
  lastDate: string | null; lastOdometer: number | null
  nextDate: string | null; nextOdometer: number | null
  enabled: boolean; status?: string; daysLeft?: number | null; kmLeft?: number | null
}

export default function RemindersPage() {
  const router = useRouter()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dueList, setDueList] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', category: 'maintenance', remindType: 'time', intervalDays: '', intervalKm: '', lastDate: '', lastOdometer: '' })

  const fetchReminders = () => {
    fetch('/api/reminders', { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.json()).then(d => { setReminders(d); setLoading(false) })
    fetch('/api/reminders/due', { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.json()).then(d => setDueList(d)).catch(() => {})
  }

  useEffect(() => { fetchReminders() }, [])

  const save = async () => {
    const body: any = { title: form.title, category: form.category, remindType: form.remindType }
    if (form.intervalDays) body.intervalDays = form.intervalDays
    if (form.intervalKm) body.intervalKm = form.intervalKm
    if (form.lastDate) body.lastDate = form.lastDate
    if (form.lastOdometer) body.lastOdometer = form.lastOdometer

    const url = editId ? `/api/reminders/${editId}` : '/api/reminders'
    await fetch(url, {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' },
      body: JSON.stringify(body),
    })
    setShowModal(false); setEditId(null); fetchReminders()
  }

  const del = async (id: string) => {
    if (!confirm('确定删除？')) return
    await fetch(`/api/reminders/${id}`, { method: 'DELETE', headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
    fetchReminders()
  }

  const toggleEnabled = async (r: Reminder) => {
    await fetch(`/api/reminders/${r.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' },
      body: JSON.stringify({ ...r, enabled: !r.enabled }),
    })
    fetchReminders()
  }

  const openNew = () => {
    setForm({ title: '', category: 'maintenance', remindType: 'time', intervalDays: '', intervalKm: '', lastDate: '', lastOdometer: '' })
    setEditId(null); setShowModal(true)
  }

  const edit = (r: Reminder) => {
    setForm({ title: r.title, category: r.category, remindType: r.remindType,
      intervalDays: r.intervalDays?.toString() || '', intervalKm: r.intervalKm?.toString() || '',
      lastDate: r.lastDate ? new Date(r.lastDate).toISOString().slice(0,10) : '',
      lastOdometer: r.lastOdometer?.toString() || '' })
    setEditId(r.id); setShowModal(true)
  }

  const statusBadge = (s: string, d: number | null) => {
    if (s === 'overdue') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">已过期</span>
    if (s === 'soon') return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">即将到期 ({(d||0)}天)</span>
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{(d||0)}天后</span>
  }

  const calcNext = () => {
    let next = ''
    if (form.intervalDays && form.lastDate) {
      const d = new Date(form.lastDate); d.setDate(d.getDate() + parseInt(form.intervalDays))
      next += `下次: ${d.toLocaleDateString('zh-CN')}`
    }
    if (form.intervalKm && form.lastOdometer) {
      next += ` (${parseFloat(form.lastOdometer) + parseFloat(form.intervalKm)} km)`
    }
    return next
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-blue-600 hover:text-blue-800">&larr;</button>
          <span className="text-2xl">⏰</span>
          <h1 className="text-xl font-bold text-gray-800">保养提醒</h1>
        </div>
        <button onClick={openNew} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700">+ 新建提醒</button>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Overdue/Soon alerts */}
        {dueList.filter(r => r.status === 'overdue' || r.status === 'soon').length > 0 && (
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
            <h2 className="font-bold text-red-600 mb-3">⚠️ 待处理提醒</h2>
            {dueList.filter(r => r.status === 'overdue' || r.status === 'soon').map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="font-medium text-gray-800">{r.title}</span>
                  <span className="text-xs text-gray-400 ml-2">{REMINDER_CATS[r.category] || r.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'overdue'
                    ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">已过期 {Math.abs(r.daysLeft || 0)} 天</span>
                    : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{(r.daysLeft || 0)} 天后到期</span>}
                  <button onClick={() => edit(r)} className="text-xs text-blue-500 hover:underline">更新</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All reminders table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs">
                <th className="py-2 px-3 text-left">提醒项目</th>
                <th className="py-2 px-3 text-left">类别</th>
                <th className="py-2 px-3 text-left">周期</th>
                <th className="py-2 px-3 text-left">上次</th>
                <th className="py-2 px-3 text-left">下次</th>
                <th className="py-2 px-3 text-center">状态</th>
                <th className="py-2 px-3 text-center">操作</th>
              </tr></thead>
              <tbody>
                {reminders.map(r => (
                  <tr key={r.id} className={`border-b last:border-0 hover:bg-gray-50 ${!r.enabled ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{r.title}</td>
                    <td className="py-2.5 px-3 text-xs">{REMINDER_CATS[r.category] || r.category}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">
                      {r.remindType === 'time' || r.remindType === 'both' ? `${r.intervalDays}天` : ''}
                      {r.remindType === 'both' ? ' / ' : ''}
                      {r.remindType === 'mileage' || r.remindType === 'both' ? `${r.intervalKm}km` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">
                      {r.lastDate ? new Date(r.lastDate).toLocaleDateString('zh-CN') : '-'}
                      {r.lastOdometer ? ` (${r.lastOdometer}km)` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 text-xs font-medium">
                      {r.nextDate ? new Date(r.nextDate).toLocaleDateString('zh-CN') : ''}
                      {r.nextOdometer ? ` / ${r.nextOdometer}km` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {dueList.find(d => d.id === r.id)?.status
                        ? statusBadge(dueList.find(d => d.id === r.id)!.status!, dueList.find(d => d.id === r.id)!.daysLeft!)
                        : <span className="text-xs text-gray-400">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button onClick={() => toggleEnabled(r)} className="text-xs mr-2">{r.enabled ? '⏸️' : '▶️'}</button>
                      <button onClick={() => edit(r)} className="text-blue-500 hover:text-blue-700 text-xs mr-2">编辑</button>
                      <button onClick={() => del(r.id)} className="text-red-500 hover:text-red-700 text-xs">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reminders.length === 0 && <div className="py-12 text-center text-gray-400">暂无提醒，点击右上角新建</div>}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">{editId ? '编辑提醒' : '新建提醒'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">提醒项目</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="如 更换机油" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">类别</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border rounded px-3 py-2 text-sm">
                    {Object.entries(REMINDER_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">提醒方式</label>
                  <select value={form.remindType} onChange={e => setForm({...form, remindType: e.target.value})} className="w-full border rounded px-3 py-2 text-sm">
                    <option value="time">按时间</option>
                    <option value="mileage">按里程</option>
                    <option value="both">时间和里程</option>
                  </select>
                </div>
              </div>
              {(form.remindType === 'time' || form.remindType === 'both') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">间隔天数</label>
                    <input type="number" value={form.intervalDays} onChange={e => setForm({...form, intervalDays: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm" placeholder={form.category === 'insurance' ? '365' : '180'} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">上次日期</label>
                    <input type="date" value={form.lastDate} onChange={e => setForm({...form, lastDate: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
              {(form.remindType === 'mileage' || form.remindType === 'both') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">间隔里程 (km)</label>
                    <input type="number" value={form.intervalKm} onChange={e => setForm({...form, intervalKm: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm" placeholder="如 5000" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">上次里程</label>
                    <input type="number" value={form.lastOdometer} onChange={e => setForm({...form, lastOdometer: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm" placeholder="km" />
                  </div>
                </div>
              )}
              {calcNext() && <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">{calcNext()}</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 border rounded py-2 text-sm">取消</button>
              <button onClick={save} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700">{editId ? '保存' : '创建'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
