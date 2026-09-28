'use client'

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Warn before leaving a form with unsaved edits.  (S1-018)
 *
 * Returns the dialog; render it anywhere inside the form's component:
 *
 *     const leaveDialog = useUnsavedChanges(dirty && !busy)
 *     return <form>... {leaveDialog}</form>
 *
 * Two mechanisms, because neither one covers the other:
 *
 * 1. `beforeunload` catches reload, closing the tab, and navigating away from
 *    the app entirely. It cannot be customised -- the browser shows its own
 *    wording and its own dialog -- and it does nothing for in-app navigation.
 *
 * 2. A capture-phase click listener catches in-app `<Link>` clicks, which
 *    never reach `beforeunload` at all. The App Router has no supported route
 *    blocker: `next/navigation`'s router exposes no `events` and no
 *    `useBlocker`, so intercepting the click before Next sees it is the only
 *    hook there is.
 *
 * Capture phase matters: by the bubble phase Next's Link has already called
 * `router.push`, and stopping it then is too late.
 *
 * A Chakra dialog cannot answer synchronously the way `window.confirm` did, so
 * every guarded click is cancelled outright and the destination is kept aside.
 * "Tinggalkan" then navigates there itself; the listener never sees that
 * navigation because `router.push` is not a click.
 */
export function useUnsavedChanges(dirty: boolean): ReactNode {
  const router = useRouter()
  const stayRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<URL | null>(null)

  useEffect(() => {
    if (!dirty) return

    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Required by older browsers; modern ones ignore the string and show
      // their own text. Setting it is harmless and still needed by some.
      event.returnValue = ''
    }

    const warnOnLinkClick = (event: MouseEvent) => {
      // Let the browser's own handling win for anything that was never a
      // plain left click on a link: modified clicks open a new tab, and a new
      // tab leaves this form exactly where it is.
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || anchor.target === '_blank') return
      if (href === window.location.pathname) return

      event.preventDefault()
      event.stopPropagation()
      // anchor.href, not the attribute: it is already resolved against the
      // current page, so a relative link and an external one both arrive whole.
      setPending(new URL(anchor.href))
    }

    window.addEventListener('beforeunload', warnOnUnload)
    document.addEventListener('click', warnOnLinkClick, true)
    return () => {
      window.removeEventListener('beforeunload', warnOnUnload)
      document.removeEventListener('click', warnOnLinkClick, true)
    }
  }, [dirty])

  function leave() {
    if (!pending) return
    setPending(null)
    if (pending.origin === window.location.origin) {
      router.push(pending.pathname + pending.search + pending.hash)
    } else {
      window.location.assign(pending.href)
    }
  }

  return (
    <AlertDialog
      isOpen={pending !== null}
      leastDestructiveRef={stayRef}
      onClose={() => setPending(null)}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent borderRadius="20px">
          <AlertDialogHeader fontSize="lg" fontWeight="700">
            Perubahan belum disimpan
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text fontSize="sm" color="gray.400">
              Kalau kamu tinggalkan halaman ini sekarang, perubahan yang belum disimpan akan
              hilang.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter gap="12px">
            <Button ref={stayRef} variant="brand" onClick={() => setPending(null)}>
              Tetap di sini
            </Button>
            <Button variant="outline" colorScheme="red" onClick={leave}>
              Tinggalkan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}
