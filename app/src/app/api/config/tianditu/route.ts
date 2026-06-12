import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: 'tianditu_key' } })
    return NextResponse.json({ key: row?.value || '' })
  } catch {
    return NextResponse.json({ key: '' })
  }
}
