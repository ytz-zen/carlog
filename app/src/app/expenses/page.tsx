'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES: Record<string, string> = {
  insurance: '保险', fuel: '加油', parking: '停车/车位', toll: '过路费',
  fine: '罚款', carWash: '洗车', maintenance: '保养', repair: '维修',
  upgrade: '升级改造', other: '其他',
}

const CATEGORY_COLORS: Record<string, string> = {
  insurance: '#6366f1', fuel: '#f59e0b', parking: '#10b981', toll: '#3b82f6',
  fine: '#ef4444', carWash: '#06b6d4', maintenance: '#8b5cf6', repair: '#f97316',
  upgrade: '#ec4899', other: '#6b7280',
}

interface Expense {
  id: string; category: string; amount: number; date: string
  odometer: number | null; description: string | null; note: string | null
  attachments: { id: string; filename: string; size: number; mimetype: string }[]
}

export default function ExpensePage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [page, setPage] = useState(1)

  // New/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ category: 'other', amount: 0, date: new Date().toISOString().slice(0,10), odometer: '', description: '', note: '' })
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  // Fuel-specific: any 2 of price/volume/amount → calc 3rd
  const [fuelInput, setFuelInput] = useState<{ price: string; volume: string; total: string }>({ price: '', volume: '', total: '' })

  const fetchExpenses = () => {
    const params = new URLSearchParams({ page: String(page), size: '20' })
    if (filterCategory) params.set('category', filterCategory)
    if (filterSearch) params.set('search', filterSearch)
    if (filterStart) params.set('start', filterStart)
    if (filterEnd) params.set('end', filterEnd)
    fetch(`/api/expenses?${params}`, { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.json()).then(d => { setExpenses(d.expenses || []); setLoading(false) }).catch(() => setLoading(false))
  }

  const fetchStats = () => {
    fetch('/api/expenses/stats?period=365', { headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
      .then(r => r.json()).then(d => setStats(d)).catch(() => {})
  }

  useEffect(() => { fetchExpenses(); fetchStats() }, [page, filterCategory])

  const saveExpense = async () => {
    // Sync fuel total → form.amount
    const finalAmount = form.category === 'fuel' && fuelInput.total
      ? parseFloat(fuelInput.total)
      : form.amount
    // Auto-set description for fuel with price & volume
    let finalDesc = form.description
    if (form.category === 'fuel' && fuelInput.price && fuelInput.volume && !form.description) {
      finalDesc = `加油: ¥${fuelInput.price}/L × ${fuelInput.volume}L`
    }
    const body = { category: form.category, amount: finalAmount, date: form.date, odometer: form.odometer ? parseFloat(form.odometer) : null, description: finalDesc, note: form.note }
    const url = editId ? `/api/expenses/${editId}` : '/api/expenses'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-API-Key': 'carlog_dev_key_2026' }, body: JSON.stringify(body) })
    const data = await res.json()

    if (uploadFiles && uploadFiles.length > 0 && (data?.id || editId)) {
      const fid = data?.id || editId
      const fd = new FormData()
      fd.append('file', uploadFiles[0])
      await fetch(`/api/expenses/${fid}/attachments`, { method: 'POST', headers: { 'X-API-Key': 'carlog_dev_key_2026' }, body: fd })
    }

    setShowModal(false); setEditId(null); setUploadFiles(null)
    fetchExpenses(); fetchStats()
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('确定删除这条费用记录？')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers: { 'X-API-Key': 'carlog_dev_key_2026' } })
    fetchExpenses(); fetchStats()
  }

  const edit = (e: Expense) => {
    setForm({ category: e.category, amount: e.amount, date: new Date(e.date).toISOString().slice(0,10), odometer: e.odometer?.toString() || '', description: e.description || '', note: e.note || '' })
    setEditId(e.id); setShowModal(true)
  }

  const openNew = () => {
    setForm({ category: 'other', amount: 0, date: new Date().toISOString().slice(0,10), odometer: '', description: '', note: '' })
    setFuelInput({ price: '', volume: '', total: '' })
    setEditId(null); setShowModal(true)
  }

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const catSum = Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v, total: expenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-blue-600 hover:text-blue-800">&larr;</button>
          <span className="text-2xl">💰</span>
          <h1 className="text-xl font-bold text-gray-800">费用管理</h1>
        </div>
        <button onClick={openNew} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 transition">+ 新增费用</button>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="text-xs text-gray-400">总花费</div>
              <div className="text-xl font-bold text-red-600">¥{stats.allTime.toLocaleString()}</div>
              <div className="text-xs text-gray-400">{stats.allCount} 笔</div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="text-xs text-gray-400">近一年</div>
              <div className="text-xl font-bold text-orange-600">¥{stats.periodTotal.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="text-xs text-gray-400">最大开支</div>
              <div className="text-xl font-bold text-purple-600">{CATEGORIES[stats.topCategory?.category] || '-'}</div>
              <div className="text-xs text-gray-400">¥{(stats.topCategory?.total || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <div className="text-xs text-gray-400">当前页合计</div>
              <div className="text-xl font-bold text-blue-600">¥{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {catSum.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">📊 类别分布</h2>
            <div className="flex flex-wrap gap-2">
              {catSum.map(c => (
                <span key={c.key} className="text-xs px-2 py-1 rounded-full" style={{ background: CATEGORY_COLORS[c.key] + '22', color: CATEGORY_COLORS[c.key], border: `1px solid ${CATEGORY_COLORS[c.key]}44` }}>
                  {c.label} ¥{c.total.toLocaleString()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border shadow-sm p-3 flex flex-wrap gap-2 items-center">
          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }} className="border rounded px-2 py-1.5 text-xs">
            <option value="">全部分类</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="border rounded px-2 py-1.5 text-xs" placeholder="开始日期" />
          <span className="text-xs text-gray-400">~</span>
          <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="border rounded px-2 py-1.5 text-xs" placeholder="结束日期" />
          <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="border rounded px-2 py-1.5 text-xs flex-1 min-w-[150px]" placeholder="搜索描述..." />
          <button onClick={() => { fetchExpenses(); fetchStats() }} className="bg-gray-600 text-white rounded px-3 py-1.5 text-xs hover:bg-gray-700">查询</button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs">
                <th className="py-2 px-3 text-left">日期</th>
                <th className="py-2 px-3 text-left">类别</th>
                <th className="py-2 px-3 text-left">描述</th>
                <th className="py-2 px-3 text-right">金额</th>
                <th className="py-2 px-3 text-right">里程</th>
                <th className="py-2 px-3 text-center">附件</th>
                <th className="py-2 px-3 text-center">操作</th>
              </tr></thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{new Date(e.date).toLocaleDateString('zh-CN')}</td>
                    <td className="py-2 px-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: CATEGORY_COLORS[e.category] + '22', color: CATEGORY_COLORS[e.category] }}>{CATEGORIES[e.category] || e.category}</span></td>
                    <td className="py-2 px-3 text-gray-700 max-w-[200px] truncate">{e.description || '-'}</td>
                    <td className="py-2 px-3 text-right font-semibold text-red-600">¥{e.amount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{e.odometer ? `${e.odometer} km` : '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-400">
                      {e.attachments?.length > 0 && <span title={e.attachments.map(a => a.filename).join(', ')}>📎 ×{e.attachments.length}</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => edit(e)} className="text-blue-500 hover:text-blue-700 text-xs mr-2">编辑</button>
                      <button onClick={() => deleteExpense(e.id)} className="text-red-500 hover:text-red-700 text-xs">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expenses.length === 0 && <div className="py-12 text-center text-gray-400">暂无费用记录</div>}
        </div>
      </main>

      {/* New/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">{editId ? '编辑费用' : '新增费用'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">类别</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {form.category === 'fuel' ? (
                  <>
                    <div>
                      <label className="text-xs text-gray-500">单价 (¥/L)</label>
                      <input type="number" step="0.01" value={fuelInput.price} onChange={e => {
                        const v = e.target.value
                        const vol = fuelInput.volume
                        const tot = fuelInput.total
                        const nv = v ? parseFloat(v) : 0
                        // if price + volume → calc total
                        if (v && vol) setFuelInput({ price: v, volume: vol, total: (nv * parseFloat(vol)).toFixed(2) })
                        else { setFuelInput({ ...fuelInput, price: v }); setForm(f => ({ ...f, amount: tot ? parseFloat(tot) : 0 })) }
                      }} className="w-full border rounded px-3 py-2 text-sm" placeholder="如 8.50" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">油量 (L)</label>
                      <input type="number" step="0.1" value={fuelInput.volume} onChange={e => {
                        const v = e.target.value
                        const price = fuelInput.price
                        const tot = fuelInput.total
                        const nv = v ? parseFloat(v) : 0
                        // if volume + price → calc total
                        if (v && price) setFuelInput({ price, volume: v, total: (parseFloat(price) * nv).toFixed(2) })
                        // if volume + total → calc price
                        else if (v && tot) setFuelInput({ price: (parseFloat(tot) / nv).toFixed(2), volume: v, total: tot })
                        else { setFuelInput({ ...fuelInput, volume: v }) }
                      }} className="w-full border rounded px-3 py-2 text-sm" placeholder="如 45.0" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">总价 (¥)</label>
                      <input type="number" step="0.01" value={fuelInput.total} onChange={e => {
                        const v = e.target.value
                        const price = fuelInput.price
                        const vol = fuelInput.volume
                        const nv = v ? parseFloat(v) : 0
                        // if total + price → calc volume
                        if (v && price) setFuelInput({ price, volume: (nv / parseFloat(price)).toFixed(1), total: v })
                        // if total + volume → calc price
                        else if (v && vol) setFuelInput({ price: (nv / parseFloat(vol)).toFixed(2), volume: vol, total: v })
                        else { setFuelInput({ ...fuelInput, total: v }) }
                      }} className="w-full border rounded px-3 py-2 text-sm font-semibold text-red-600" placeholder="自动计算" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-xs text-gray-500">金额 (¥)</label>
                    <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500">日期</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">里程 (km, 可选)</label>
                <input type="number" value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="如 52340" />
              </div>
              <div>
                <label className="text-xs text-gray-500">描述</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="如 交强险续保" />
              </div>
              <div>
                <label className="text-xs text-gray-500">备注</label>
                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label className="text-xs text-gray-500">附件 (图片/PDF)</label>
                <input type="file" onChange={e => setUploadFiles(e.target.files)} className="w-full text-sm" accept="image/*,.pdf,.doc,.docx" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 border rounded py-2 text-sm">取消</button>
              <button onClick={saveExpense} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700">{editId ? '保存' : '新增'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
