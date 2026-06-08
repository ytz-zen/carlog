import { jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || 'carlog_default_secret_change_me_2026'
)

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

/** Check X-API-Key header (Android app) */
export function checkApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key') || ''
  const expected = process.env.API_KEY || 'carlog_dev_key_2026'
  return apiKey === expected
}

/** Check either JWT cookie (web) or X-API-Key (Android) */
export async function checkAnyAuth(request: Request): Promise<boolean> {
  return checkApiKey(request) || await checkCookieAuth(request)
}
