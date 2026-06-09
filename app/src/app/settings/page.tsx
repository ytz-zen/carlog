'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => { setSettings(d); setLoaded(true) })
  }, [])

  const save = async () => {
    setSaving(true)
    const body: Record<string, string> = {}
    for (const key of ['tianditu_key', 'webhook_url', 'dashboard_password', 'push_trip_start', 'push_trip_end', 'api_key']) {
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

  if (!loaded) return <div className="min-h-screen flex items-center justify-center text-slate-400">加载中...</div>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-indigo-600 hover:text-indigo-800 text-lg">&larr;</button>
        <h1 className="text-lg font-semibold text-slate-800">⚙️ 系统设置</h1>
      </header>
      <main className="max-w-xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">🌏 天地图 API Key</label>
            <input id="tianditu_key" key={`tk-${settings.tianditu_key}`} defaultValue={settings.tianditu_key || ''}
              className="input" placeholder="去 tianditu.gov.cn 注册获取" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">💬 企业微信 Webhook URL</label>
            <input id="webhook_url" key={`wh-${settings.webhook_url}`} defaultValue={settings.webhook_url || ''}
              className="input" placeholder="群机器人 Webhook 地址" />
            <p className="text-xs text-slate-400 mt-1">用于推送行程开始/结束提醒</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">🔑 Android API Key</label>
            <input id="api_key" key={`ak-${settings.api_key}`} defaultValue={settings.api_key || ''}
              className="input font-mono" placeholder="Android 端连接用密钥" />
            <p className="text-xs text-slate-400 mt-1">修改后 Android 端设置中也要同步修改</p>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">🔔 推送开关</h3>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" id="push_trip_start" key={`ps-${settings.push_trip_start}`}
                defaultChecked={settings.push_trip_start !== 'false'} className="rounded" />
              行程开始时推送
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 mt-2">
              <input type="checkbox" id="push_trip_end" key={`pe-${settings.push_trip_end}`}
                defaultChecked={settings.push_trip_end !== 'false'} className="rounded" />
              行程结束时推送
            </label>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">🔑 修改登录密码</label>
            <input id="dashboard_password" type="password" key={`pw-${settings.dashboard_password}`}
              defaultValue="" className="input" placeholder="留空不修改" />
          </div>
          <button onClick={save} disabled={saving}
            className="btn btn-primary w-full justify-center">
            {saving ? '保存中...' : '保存设置'}
          </button>
          {msg && <p className="text-emerald-600 text-sm text-center">{msg}</p>}
        </div>
      </main>
    </div>
  )
}
