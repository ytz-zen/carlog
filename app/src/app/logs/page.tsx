'use client'
import { useState, useEffect, useCallback } from 'react'

interface LogEntry {
  id: string
  timestamp: string
  level: string
  message: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = useCallback(async () => {
    setRefreshing(true)
    try {
      const url = new URL('/api/logs', window.location.origin)
      if (selectedLevel !== 'all') url.searchParams.set('level', selectedLevel)
      url.searchParams.set('limit', '500')

      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs)
      }
    } catch (e) {
      console.error('获取日志失败', e)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [selectedLevel])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchLogs, 10000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchLogs])

  const levelColors: Record<string, string> = {
    error: '#ff4444',
    warn: '#ff9800',
    info: '#4caf50',
  }

  const levelLabels: Record<string, string> = {
    error: '❌ 错误',
    warn: '⚠️ 警告',
    info: 'ℹ️ 信息',
  }

  const errorCount = logs.filter(l => l.level === 'error').length
  const warnCount = logs.filter(l => l.level === 'warn').length

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>📋 运行日志</h1>

      {/* 统计条 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ background: '#1a1a2e', padding: '12px 20px', borderRadius: 8, minWidth: 120 }}>
          <div style={{ color: '#888', fontSize: 12 }}>总日志</div>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>{logs.length}</div>
        </div>
        {errorCount > 0 && (
          <div style={{ background: '#3d1111', padding: '12px 20px', borderRadius: 8 }}>
            <div style={{ color: '#ff6b6b', fontSize: 12 }}>错误</div>
            <div style={{ color: '#ff4444', fontSize: 24, fontWeight: 'bold' }}>{errorCount}</div>
          </div>
        )}
        {warnCount > 0 && (
          <div style={{ background: '#3d2a11', padding: '12px 20px', borderRadius: 8 }}>
            <div style={{ color: '#ffb74d', fontSize: 12 }}>警告</div>
            <div style={{ color: '#ff9800', fontSize: 24, fontWeight: 'bold' }}>{warnCount}</div>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedLevel}
          onChange={e => setSelectedLevel(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, background: '#1a1a2e', color: '#fff', border: '1px solid #333' }}
        >
          <option value="all">全部级别</option>
          <option value="error">❌ 错误</option>
          <option value="warn">⚠️ 警告</option>
          <option value="info">ℹ️ 信息</option>
        </select>

        <button
          onClick={fetchLogs}
          disabled={refreshing}
          style={{
            padding: '8px 16px', borderRadius: 6, background: refreshing ? '#666' : '#4caf50',
            color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          {refreshing ? '刷新中...' : '🔄 手动刷新'}
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
          />
          自动刷新 (10s)
        </label>

        <span style={{ color: '#666', fontSize: 12, marginLeft: 'auto' }}>
          {autoRefresh ? '🟢 实时' : '⏸️ 暂停'}
        </span>
      </div>

      {/* 日志表格 */}
      {loading ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>加载中...</div>
      ) : logs.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>
          暂无日志
          <br />
          <span style={{ fontSize: 12 }}>在 Android 设置中开启"实时推送日志"以查看运行日志</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#888', fontWeight: 600 }}>时间</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#888', fontWeight: 600, width: 80 }}>级别</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#888', fontWeight: 600 }}>消息</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid #1a1a2e',
                    background: log.level === 'error' ? 'rgba(255,68,68,0.05)' : log.level === 'warn' ? 'rgba(255,152,0,0.05)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 12px', color: '#888' }}>
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: levelColors[log.level] || '#fff',
                      background: log.level === 'error' ? '#3d1111' : log.level === 'warn' ? '#3d2a11' : '#113d11',
                    }}>
                      {levelLabels[log.level] || log.level}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#ddd', wordBreak: 'break-word', maxWidth: '80vw' }}>
                    {log.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
