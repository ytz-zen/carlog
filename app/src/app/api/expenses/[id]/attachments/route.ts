import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkApiKey } from '@/lib/auth'
import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// POST: upload file to expense
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  // Save file
  const ext = path.extname(file.name)
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
  const dir = path.join(UPLOAD_DIR, id)
  await mkdir(dir, { recursive: true })
  const filepath = path.join(dir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  const attachment = await prisma.attachment.create({
    data: {
      expenseId: id,
      filename: file.name,
      filepath,
      mimetype: file.type,
      size: file.size,
    },
  })

  return NextResponse.json(attachment)
}

// DELETE: remove attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = request.headers.get('X-API-Key')
  if (!key || key !== (process.env.API_KEY || 'carlog_dev_key_2026'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)
  const attId = url.searchParams.get('attId')
  if (!attId) return NextResponse.json({ error: 'No attId' }, { status: 400 })

  const att = await prisma.attachment.findUnique({ where: { id: attId } })
  if (att) {
    await unlink(att.filepath).catch(() => {})
    await prisma.attachment.delete({ where: { id: attId } })
  }
  return NextResponse.json({ ok: true })
}
