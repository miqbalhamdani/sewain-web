import createClient, { type Middleware } from 'openapi-fetch'

import type { components, paths } from 'lib/api/schema'

type Session = components['schemas']['Session']

// The API client.  (S1-013)
//
// Generated types, never a hand-written client: an endpoint that is not in
// ../docs/openapi.yaml fails to compile here rather than 404ing at runtime.
// If you need one that does not exist, that is a contract PR.

/**
 * The API always lives at the origin currently being served, plus `/api/v1`.
 *
 * Never a constant, never `api:8080`. One hardcoded host here and every tenant
 * renders one owner's catalogue (BR-030). In the browser that means a relative
 * path; on the server the caller passes the origin it read from `headers()`.
 *
 * Locally, `next.config.js` forwards `/api/v1/*` to the Go API on :8080, which
 * is the same job Caddy does in production (S1-060).
 */
export const API_PREFIX = '/api/v1'

/** Where an unverified session is sent. Kept here so the interceptor and the
 * guards cannot disagree about the path. */
export const VERIFY_PATH = '/verify-email'
export const LOGIN_PATH = '/login'

let accessToken: string | null = null

/**
 * The in-flight refresh, so two callers never rotate the same cookie.
 *
 * This is not an optimisation. The refresh chain treats a second use of an
 * already-rotated token as theft and revokes every session the user has
 * (BR-004, S1-008) — so two concurrent refreshes do not race harmlessly, they
 * log the person out everywhere. Boot and the verification screen both want a
 * fresh token, and without this they ask at the same moment.
 */
let inFlightRefresh: Promise<Session | null> | null = null

/**
 * Trade the httpOnly refresh cookie for a new access token, once.
 *
 * Concurrent callers share one request and one answer.
 */
export function refreshSession(): Promise<Session | null> {
  inFlightRefresh ??= api
    .POST('/auth/refresh')
    .then(({ data }) => {
      if (data) setAccessToken(data.access_token)
      return data ?? null
    })
    .finally(() => {
      inFlightRefresh = null
    })
  return inFlightRefresh
}

/**
 * The access token lives in memory and nowhere else.
 *
 * Not localStorage: anything a script on the page can read, a script on the
 * page can exfiltrate. Surviving a reload is the refresh cookie's job — it is
 * httpOnly, so no script reaches it, and the app calls `/auth/refresh` on boot
 * to trade it for a new access token.
 */
export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

const withAuth: Middleware = {
  async onRequest({ request }) {
    if (accessToken) {
      request.headers.set('Authorization', `Bearer ${accessToken}`)
    }
    return request
  },
}

/**
 * `403 email-not-verified` can arrive from any endpoint, so it is handled once
 * here rather than as a toast on every screen (BR-006).
 *
 * The redirect is a hard navigation rather than a router push: this module has
 * no router, and an unverified session has nothing to preserve on the screen it
 * is leaving anyway.
 */
const withVerificationWall: Middleware = {
  async onResponse({ response }) {
    if (response.status !== 403 || typeof window === 'undefined') return response

    // Reading the body consumes it, so work on a clone and hand the original
    // back untouched for callers that do render the problem.
    const problem: Problem | null = await response
      .clone()
      .json()
      .catch((): null => null)
    if (problem?.type?.endsWith('/email-not-verified')) {
      if (window.location.pathname !== VERIFY_PATH) {
        window.location.assign(VERIFY_PATH)
      }
    }
    return response
  },
}

export const api = createClient<paths>({ baseUrl: API_PREFIX })
api.use(withAuth, withVerificationWall)

/**
 * A server-side client, pointed at the origin being served.
 *
 * The origin comes from the request headers, never a constant — the same rule
 * as the browser client, for the same reason.
 */
export function serverApi(origin: string, token?: string) {
  const client = createClient<paths>({ baseUrl: `${origin}${API_PREFIX}` })
  if (token) {
    client.use({
      async onRequest({ request }) {
        request.headers.set('Authorization', `Bearer ${token}`)
        return request
      },
    })
  }
  return client
}

/** The RFC 9457 body every error in this API carries. */
export type Problem = {
  type: string
  title: string
  status: number
  detail?: string
  trace_id: string
  errors?: { field: string; detail?: string }[]
}

/** The problem code, which is the last segment of `type`. */
export function problemCode(problem: unknown): string {
  const type = (problem as Problem | null)?.type
  return typeof type === 'string' ? (type.split('/').pop() ?? '') : ''
}

/**
 * Field-level messages, keyed by field name.
 *
 * A 422 that names a field belongs next to that input, not in a toast the user
 * has to map back to the form themselves.
 */
export function fieldErrors(problem: unknown): Record<string, string> {
  const errors = (problem as Problem | null)?.errors ?? []
  return Object.fromEntries(
    errors.map((e) => [e.field, e.detail ?? (problem as Problem).detail ?? '']),
  )
}
