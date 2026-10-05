import type { PropsWithChildren } from 'react'

import './public.css'

/**
 * The public page and the renter portal: no Chakra, no Horizon CSS, no session
 * (CLAUDE.md). Nothing here imports from (app).
 */
export default function PublicLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">{children}</div>
    </div>
  )
}
