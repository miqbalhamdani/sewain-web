'use client'

import { useCallback, useState } from 'react'

/**
 * One `Idempotency-Key` per user intent (BR-090, CLAUDE.md).
 *
 * Made when the form opens and reused on every retry of that same submit -- a
 * new key per attempt is a new intent, and the booking it creates is exactly
 * the duplicate the header exists to prevent. `renew` is for after a success,
 * when the next submit really is a different booking.
 */
export function useIdempotencyKey(): [string, () => void] {
  const [key, setKey] = useState(() => crypto.randomUUID())
  const renew = useCallback(() => setKey(crypto.randomUUID()), [])
  return [key, renew]
}
