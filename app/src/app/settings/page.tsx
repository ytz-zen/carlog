'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(setSettings)
  }, [])

  const save = async () => {
    setSaving(true)
    const body: Record<string, string> = {}
    for (const key of ['tianditu_key', 'webhook_url', 'dashboard_password']) {
      const el = document.getElementById(key) as HTMLInputElement
      if (el?.value) body[key] = el.value
    }
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    setSaving(false)
    setMsg('保存成功')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-blue-600 hover:text-blue-800">&larr;</button>
        <h1 className="text-lg font-bold text-gray-800">⚙️ 系统设置</h1>
      </header>
      <main className="max-w-xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">🌏 天地图 API Key</label>
            <input id="tianditu_key" defaultValue={settings.tianditu_key || ''} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="去 tianditu.gov.cn 注册获取" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">💬 企业微信 Webhook URL</label>
            <input id="webhook_url" defaultValue={settings.webhook_url || ''} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="群机器人 Webhook 地址" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">🔑 修改登录密码</label>
            <input id="dashboard_password" type="password" defaultValue={settings.dashboard_password || ''} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="留空不修改" />
          </div>
          <button onClick={save} disabled={saving}
            className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存设置'}
          </button>
          {msg && <p className="text-green-600 text-sm text-center">{msg}</p>}
        </div>
      </main>
    </div>
  )
}
