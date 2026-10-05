import type { ReactNode } from 'react'

import type { components } from 'lib/api/schema'
import { toJakartaLocal } from 'lib/format/datetime'

/** Small pieces both public screens share. Plain Tailwind, no session. */

export type Owner = components['schemas']['PublicOwner']
type Vehicle = components['schemas']['VehicleSpec']

/** wa.me wants digits only; the stored number is already +62… (BR-096). */
export function waLink(whatsapp: string, text?: string) {
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}${q}`
}

export function WhatsAppButton({ whatsapp, text, children, primary = true }: {
  whatsapp: string; text?: string; children: ReactNode; primary?: boolean
}) {
  return (
    <a href={waLink(whatsapp, text)} target="_blank" rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${primary
        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
        : 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100'}`}>
      {children}
    </a>
  )
}

export function OwnerHeader({ owner }: { owner: Owner }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{owner.name}</h1>
        <p className="mt-1 text-sm text-stone-600">{owner.address}</p>
        {owner.operating_hours && <p className="text-sm text-stone-500">{owner.operating_hours}</p>}
      </div>
      <WhatsAppButton whatsapp={owner.whatsapp} primary={false}>Chat WhatsApp</WhatsAppButton>
    </header>
  )
}

const TRANSMISSION: Record<string, string> = { manual: 'Manual', automatic: 'Matic', clutch: 'Kopling' }
const FUEL: Record<string, string> = { gasoline: 'Bensin', diesel: 'Solar', hybrid: 'Hybrid', electric: 'Listrik' }

/** "Manual · 7 kursi · Bensin" -- resource-level only; per-unit year and colour stay private (S1-051). */
export function specLine(v: Vehicle | null): string | null {
  if (!v) return null
  return [TRANSMISSION[v.transmission], v.seats ? `${v.seats} kursi` : null, FUEL[v.fuel]].filter(Boolean).join(' · ')
}

/**
 * The searched range from the query (`mulai`/`selesai`, wall-clock Jakarta time),
 * or tomorrow 09:00 → the day after, the same default the backoffice uses.
 */
export function rangeFrom(sp: Record<string, string | string[] | undefined>) {
  const ok = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)
  const day = (offset: number) => toJakartaLocal(new Date(Date.now() + offset * 86_400_000).toISOString()).slice(0, 10)
  const searched = ok(sp.mulai) && ok(sp.selesai) && sp.selesai > sp.mulai
  return {
    searched,
    mulai: searched ? (sp.mulai as string) : `${day(1)}T09:00`,
    selesai: searched ? (sp.selesai as string) : `${day(2)}T09:00`,
  }
}

/** The public surface's 429 (§7): say when to come back, never retry by itself. */
export function RateLimited() {
  return (
    <main className="py-24 text-center">
      <h1 className="text-xl font-semibold">Terlalu banyak permintaan</h1>
      <p className="mt-2 text-sm text-stone-500">Coba lagi beberapa menit lagi.</p>
    </main>
  )
}
