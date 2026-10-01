'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

export type Crumb = {
  label: string
  /** Segmen terakhir tidak punya href — ia halaman yang sedang dibuka. */
  href?: string
}

export type PageHeader = {
  title: string
  breadcrumb: Crumb[]
}

type Store = {
  header: PageHeader | null
  setHeader: (h: PageHeader | null) => void
}

const Ctx = createContext<Store | null>(null)

/**
 * Judul halaman dialirkan ke atas, ke navbar.
 *
 * Perlu context karena navbar hidup di dalam `<Portal>`: ia keluar dari pohon
 * DOM-nya, tapi TETAP di pohon React yang sama, jadi context tembus ke sana
 * sementara prop drilling tidak bisa — layout tidak tahu halaman apa yang
 * sedang dirender di dalamnya.
 */
export function PageHeaderProvider({ children }: PropsWithChildren) {
  const [header, setHeader] = useState<PageHeader | null>(null)
  const value = useMemo(() => ({ header, setHeader }), [header])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Dibaca navbar. */
export function usePageHeader(): PageHeader | null {
  return useContext(Ctx)?.header ?? null
}

/**
 * Dipakai PageShell untuk menyetor judul halaman ini.
 *
 * Dibersihkan saat unmount supaya navbar tidak menahan judul halaman sebelumnya
 * selama halaman berikutnya masih memuat.
 */
export function useSetPageHeader(title: string, breadcrumb: Crumb[]) {
  const store = useContext(Ctx)
  const setHeader = store?.setHeader

  // Ditandatangani lewat string, bukan lewat array: `breadcrumb` adalah literal
  // baru di tiap render, jadi memakainya langsung sebagai dependensi membuat
  // effect ini jalan selamanya.
  const signature = breadcrumb.map((c) => `${c.label}\u0000${c.href ?? ''}`).join('\u0001')

  useEffect(() => {
    if (setHeader === undefined) return
    setHeader({
      title,
      breadcrumb: signature === '' ? [] : signature.split('\u0001').map((part) => {
        const [label, href] = part.split('\u0000')
        return href === '' ? { label } : { label, href }
      }),
    })
    return () => setHeader(null)
  }, [setHeader, title, signature])
}
