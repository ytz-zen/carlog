import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db'

const getSecret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || 'carlog_default_secret_change_me_2026'
)

/** 获取当前有效的 API Key（优先环境变量，次之 Web 设置，最后默认值） */
export async function getApiKey(): Promise<string> {
  if (process.env.API_KEY) return process.env.API_KEY
  const web = await prisma.systemConfig.findUnique({ where: { key: 'api_key' } })
  return web?.value || 'carlog_dev_key_2026'
}

/** 验证请求中的 X-API-Key 头 */
export async function checkApiKey(request: Request): Promise<boolean> {
  const key = request.headers.get('X-API-Key') || ''
  const expected = await getApiKey()
  return key === expected
}

/** Check JWT cookie (web dashboard) */
export async function checkCookieAuth(request: Request): Promise<boolean> {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/carlog_token=([^;]+)/)
  if (!match) return false
  try {
    await jwtVerify(match[1], getSecret())
    return true
  } catch {
    return false
  }
}

/** Check either JWT cookie (web) or X-API-Key (Android) */
export async function checkAnyAuth(request: Request): Promise<boolean> {
  return checkApiKey(request) || await checkCookieAuth(request)
}
