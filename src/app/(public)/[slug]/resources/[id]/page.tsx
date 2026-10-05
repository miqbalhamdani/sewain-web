import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Markdown } from 'components/shared/Markdown'
import { tenantApi } from 'lib/api/server'
import { fromJakartaLocal } from 'lib/format/datetime'
import { formatPrice, formatRupiah, UNIT_LABEL } from 'lib/format/money'

import { OwnerHeader, RateLimited, rangeFrom, specLine } from '../../ui'
import { RequestForm } from './RequestForm'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await (await tenantApi()).GET('/public/resources/{id}', { params: { path: { id: (await params).id } } })
  return { title: data ? data.name : 'Halaman tidak ditemukan' }
}

/**
 * One resource: spec, the owner's description and terms, the four terms the
 * system writes, and the request form.  (S1-060, S1-061, BR-095)
 */
export default async function ResourcePage({ params, searchParams }: Props) {
  const { id } = await params
  const range = rangeFrom(await searchParams)
  const api = await tenantApi()
  const [owner, res] = await Promise.all([
    api.GET('/public/owner'),
    api.GET('/public/resources/{id}', { params: { path: { id }, query: range.searched
      ? { start_at: fromJakartaLocal(range.mulai), end_at: fromJakartaLocal(range.selesai) } : {} } }),
  ])
  if (owner.response.status === 429 || res.response.status === 429) return <RateLimited />
  if (!owner.data || !res.data) notFound()
  const r = res.data
  const spec = specLine(r.vehicle)
  const unit = UNIT_LABEL[r.pricing_unit] ?? r.pricing_unit
  const bounds = [r.min_duration && `minimal ${r.min_duration} ${unit}`, r.max_duration && `maksimal ${r.max_duration} ${unit}`]
    .filter(Boolean).join(', ')
  const owned = [
    { title: 'Tidak termasuk', text: r.terms_excludes },
    { title: 'Syarat penyewa', text: r.terms_requirements },
    { title: 'Pembatalan', text: r.terms_cancellation },
  ].filter((t) => t.text) // an empty section is not shown (BR-095)

  return (
    <main>
      <OwnerHeader owner={owner.data} />
      <Link href={`/?mulai=${range.mulai}&selesai=${range.selesai}`} className="text-sm text-stone-500 hover:text-stone-800">← Semua barang</Link>

      <div className="mt-3 grid gap-6 md:grid-cols-[1fr_320px]">
        <article className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="text-xl font-bold">{r.name}</h2>
            {spec && <p className="mt-1 text-sm text-stone-600">{spec}</p>}
            <p className="mt-3 text-lg font-bold">{formatPrice(r.base_price, r.pricing_unit)}</p>
            <ul className="mt-2 space-y-0.5 text-sm text-stone-600">
              {r.deposit_amount !== null && <li>Deposit {formatRupiah(r.deposit_amount)} — dikembalikan setelah selesai, dipotong bila ada denda atau kerusakan</li>}
              {bounds && <li>Lama sewa {bounds}</li>}
            </ul>
          </section>

          {r.description && (
            <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-relaxed">
              <h3 className="mb-2 font-semibold">Deskripsi</h3>
              <Markdown text={r.description} />
            </section>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-relaxed">
            <h3 className="mb-2 font-semibold">Syarat & ketentuan</h3>
            <ul className="list-disc space-y-1 pl-5">
              {r.system_terms.map((t) => <li key={t}>{t}</li>)}
            </ul>
            {owned.map((t) => (
              <div key={t.title} className="mt-4">
                <h4 className="mb-1 font-medium">{t.title}</h4>
                <Markdown text={t.text as string} />
              </div>
            ))}
          </section>
        </article>

        <aside>
          <RequestForm resourceId={r.id} mulai={range.mulai} selesai={range.selesai} whatsapp={owner.data.whatsapp}
            availability={range.searched ? { available: !!r.available, count: r.available_count ?? 0,
              qty: r.duration_qty ?? 0, subtotal: r.subtotal ?? 0, unit } : null} />
        </aside>
      </div>
    </main>
  )
}
