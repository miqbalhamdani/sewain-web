import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { tenantApi } from 'lib/api/server'
import { fromJakartaLocal } from 'lib/format/datetime'
import { formatPrice, formatRupiah, UNIT_LABEL } from 'lib/format/money'

import { OwnerHeader, RateLimited, rangeFrom, specLine, WhatsAppButton } from './ui'

// Availability is never cached: a catalogue 60 seconds stale sells the unit that
// was just booked (CLAUDE.md, BR-025).
export const dynamic = 'force-dynamic'

type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await (await tenantApi()).GET('/public/owner')
  return { title: data ? `${data.name} · Sewa online` : 'Halaman tidak ditemukan' }
}

/**
 * The public catalogue at <slug>.sewain.id.  (S1-060, S1-068, BR-025)
 *
 * The slug in this route is the middleware's rewrite, never read here: the API
 * names the tenant from Host, so this page cannot show another rental's data
 * even if someone typed /otherslug.
 */
export default async function Catalogue({ searchParams }: { searchParams: Search }) {
  const range = rangeFrom(await searchParams)
  const api = await tenantApi()
  const [owner, list] = await Promise.all([
    api.GET('/public/owner'),
    api.GET('/public/resources', {
      params: { query: range.searched
        ? { start_at: fromJakartaLocal(range.mulai), end_at: fromJakartaLocal(range.selesai) } : {} },
    }),
  ])
  if (owner.response.status === 429 || list.response.status === 429) return <RateLimited />
  if (!owner.data || !list.data) notFound()
  const resources = list.data.data
  const query = `?mulai=${range.mulai}&selesai=${range.selesai}`

  return (
    <main>
      <OwnerHeader owner={owner.data} />

      {resources.length === 0 ? (
        <section role="status" className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <h2 className="font-semibold">Belum ada yang bisa disewa online</h2>
          <p className="mt-1 text-sm text-stone-600">Tanyakan langsung ke pemiliknya — mungkin ada yang siap untuk tanggalmu.</p>
          <div className="mt-4">
            <WhatsAppButton whatsapp={owner.data.whatsapp} text="Halo, saya mau tanya sewa.">Tanya lewat WhatsApp</WhatsAppButton>
          </div>
        </section>
      ) : (
        <>
          <form method="get" className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Mulai</span>
              <input type="datetime-local" name="mulai" defaultValue={range.mulai} required
                className="h-11 w-full rounded-xl border border-stone-300 px-3" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Selesai</span>
              <input type="datetime-local" name="selesai" defaultValue={range.selesai} required
                className="h-11 w-full rounded-xl border border-stone-300 px-3" />
            </label>
            <button type="submit" className="h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white hover:bg-stone-700">
              Cek ketersediaan
            </button>
          </form>

          <ul className="grid gap-4 sm:grid-cols-2">
            {resources.map((r) => {
              const spec = specLine(r.vehicle)
              return (
                <li key={r.id}>
                  <Link href={`/resources/${r.id}${query}`}
                    className="block h-full rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-400">
                    <h2 className="font-semibold">{r.name}</h2>
                    {spec && <p className="mt-0.5 text-sm text-stone-500">{spec}</p>}
                    <p className="mt-3 text-lg font-bold">{formatPrice(r.base_price, r.pricing_unit)}</p>
                    {r.deposit_amount !== null && <p className="text-xs text-stone-500">Deposit {formatRupiah(r.deposit_amount)}, kembali setelah selesai</p>}
                    {r.available !== null && (
                      <p className={`mt-3 text-sm font-medium ${r.available ? 'text-emerald-700' : 'text-stone-500'}`}>
                        {r.available
                          ? `Tersisa ${r.available_count} unit · ${r.duration_qty} ${UNIT_LABEL[r.pricing_unit] ?? ''} ${formatRupiah(r.subtotal ?? 0)}`
                          : 'Penuh di jam itu'}
                      </p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
          {!range.searched && <p className="mt-4 text-xs text-stone-500">Pilih tanggal di atas untuk melihat unit yang masih kosong.</p>}
        </>
      )}
    </main>
  )
}
