import { prisma } from '@/lib/db'

export async function initDefaultApiKey() {
  const existing = await prisma.apiKey.findFirst()
  if (!existing) {
    const defaultKey = process.env.API_KEY || 'carlog_dev_key_2026'
    await prisma.apiKey.create({ data: { key: defaultKey } })
    console.log('[carlog] Default API key created')
  }
}
