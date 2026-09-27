'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { api, refreshSession, setAccessToken } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type SessionUser = components['schemas']['SessionUser']
type SessionOwner = components['schemas']['SessionOwner']

type SessionValue = {
  user: SessionUser | null
  owner: SessionOwner | null

  /** True until the boot refresh has settled. Guards must wait for it, or a
   * signed-in user is bounced to /login for the first paint after every
   * reload. */
  loading: boolean

  /** Null until the boot refresh finishes, so `user === null && !loading` is
   * the only honest way to say "anonymous". */
  signIn: (session: components['schemas']['Session']) => void
  signOut: () => Promise<void>
  reload: () => Promise<void>

  /** Trade the refresh cookie for a new access token and adopt the session it
   * carries. Shared with the boot path, so two callers cannot rotate the same
   * cookie twice — which the server reads as theft. */
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

/**
 * Session state for the backoffice.  (S1-013, BR-004)
 *
 * The access token never leaves memory — see `lib/api/client`. What survives a
 * reload is the httpOnly refresh cookie, which no script can read, so booting
 * means asking `/auth/refresh` to trade it for a fresh access token.
 *
 * Everything the UI shows about who you are comes from `/me`: the business
 * name, the role, the permission list. Never from decoding the access token in
 * the browser — that token is for the server, and parsing it here would make
 * two sources of truth that can disagree.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [owner, setOwner] = useState<SessionOwner | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await api.GET('/me')
    setUser(data?.user ?? null)
    setOwner(data?.owner ?? null)
  }, [])

  const signIn = useCallback((session: components['schemas']['Session']) => {
    setAccessToken(session.access_token)
    setUser(session.user)
    setOwner(session.owner)
    setLoading(false)
  }, [])

  const signOut = useCallback(async () => {
    await api.POST('/auth/logout')
    setAccessToken(null)
    setUser(null)
    setOwner(null)
  }, [])

  const refresh = useCallback(async () => {
    const session = await refreshSession()
    if (session) {
      setUser(session.user)
      setOwner(session.owner)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      // The refresh cookie is sent automatically; there is nothing to read
      // from storage, which is the point.
      const session = await refreshSession()
      if (cancelled) return

      if (session) {
        setUser(session.user)
        setOwner(session.owner)
      }
      setLoading(false)
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ user, owner, loading, signIn, signOut, reload, refresh }),
    [user, owner, loading, signIn, signOut, reload, refresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return value
}

/**
 * Whether the signed-in role holds a permission.
 *
 * Read from `/me`, and used to *hide* actions rather than disable them: a
 * disabled button that still 403s advertises a capability the user does not
 * have and generates support questions (BR-003).
 */
export function useCan(permission: string): boolean {
  const { user } = useSession()
  return user?.permissions?.includes(permission) ?? false
}
