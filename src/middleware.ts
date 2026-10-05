import { NextResponse, type NextRequest } from 'next/server'

/**
 * Host → tenant.  (S1-060, BR-030)
 *
 * `rentalbudi.sewain.id/booking/abc` renders `(public)/[slug]/booking/[token]` with
 * slug `rentalbudi` -- an internal rewrite, so the slug never shows in the URL and is
 * never read from anything the visitor typed. Every other host (app., api., local
 * development) passes through untouched.
 *
 * The apex is configuration, not a constant (05-backlog.md): the same value the API
 * and Caddy read.
 */
const APEX = process.env.PUBLIC_APEX ?? 'sewain.localhost'
const NOT_TENANTS = new Set(['app', 'api', 'www'])

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!host.endsWith(`.${APEX}`)) return NextResponse.next()
  const label = host.slice(0, -(APEX.length + 1))
  if (label === '' || label.includes('.') || NOT_TENANTS.has(label)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/${label}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Not Next's own assets, not the API (Caddy sends /api/* straight to it), not files.
  matcher: ['/((?!_next/|api/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}
