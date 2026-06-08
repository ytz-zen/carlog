import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || 'carlog_default_secret_change_me_2026'
)

const publicPaths = ['/login', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // API routes are authenticated via X-API-Key in route handlers, not cookies
  // But /api/auth/me needs to be accessible for the login page check
  if (pathname === '/api/auth/me') {
    return NextResponse.next()
  }

  // Also allow API routes (they validate X-API-Key internally)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow static files
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon') || pathname === '/') {
    // root is the dashboard, needs auth
  }

  // Check JWT cookie
  const token = request.cookies.get('carlog_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete('carlog_token')
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
