'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { ReactNode, useState } from 'react'

import { SessionProvider } from 'contexts/SessionContext'

import 'styles/App.css'
import 'styles/Contact.css'
import 'styles/MiniCalendar.css'

import theme from '../theme/theme'

/**
 * The provider tree for the two Chakra subtrees, `(auth)` and `(app)`.
 *
 * It is imported by those two layouts and by nothing else — deliberately. The
 * root layout stays bare so `(public)/[slug]` (S1-060) never downloads Chakra,
 * emotion, or Horizon's global CSS, and never inherits a session.
 */
export default function AppWrappers({ children }: { children: ReactNode }) {
  // Created in state, not at module scope: a module-level client is shared
  // across requests on the server, which means one tenant's cached data can be
  // handed to the next.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Availability and booking data must never be served stale — a
            // cached free slot is a double booking waiting to happen (BR-025).
            staleTime: 0,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme}>
        <SessionProvider>{children}</SessionProvider>
      </ChakraProvider>
    </QueryClientProvider>
  )
}
