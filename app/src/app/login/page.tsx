'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      const data = await res.json()
      setError(data.error || '登录失败')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-80">
        <h1 className="text-2xl font-bold text-center mb-2">车行记</h1>
        <p className="text-gray-500 text-center mb-6 text-sm">行驶轨迹记录系统</p>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <input
          type="password"
          placeholder="管理员密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 transition"
        >
          登录
        </button>
      </form>
    </div>
  )
}
