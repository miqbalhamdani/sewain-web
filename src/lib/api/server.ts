import { headers } from 'next/headers'

import { serverApi } from 'lib/api/client'

/**
 * The API, called from a server component on a tenant host.  (S1-060, BR-030)
 *
 * The origin is the one being served -- read from the request, never a constant --
 * so the call goes back out through the proxy with the tenant's Host intact.
 * Calling the API's internal address instead would arrive without a tenant, and
 * every public page would 404.
 */
export async function tenantApi() {
  const h = await headers()
  return serverApi(`${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`)
}
