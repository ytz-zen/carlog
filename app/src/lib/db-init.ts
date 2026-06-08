import { prisma } from '@/lib/db'

export async function POST() {
  // Auto-register on first startup with default API key
  const existing = await prisma.apiKey.findFirst()
  if (!existing) {
    const defaultKey = process.env.API_KEY || 'carlog_secret_key'
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('default123'))
    const hashStr = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('')
    await prisma.apiKey.create({ data: { key: defaultKey, passwordHash: hashStr } })
  }
}
