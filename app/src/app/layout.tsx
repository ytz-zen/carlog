import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '车行记 - 汽车行驶记录',
  description: '汽车行驶轨迹记录与分析系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
