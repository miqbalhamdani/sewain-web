import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { tenantApi } from 'lib/api/server'
import { formatDateTime, formatRange } from 'lib/format/datetime'
import { formatRupiah, UNIT_LABEL } from 'lib/format/money'

import { RateLimited, WhatsAppButton } from '../../ui'
import { ProofUpload } from './ProofUpload'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

// The code, never the token: the token goes nowhere but the URL (CLAUDE.md).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await (await tenantApi()).GET('/portal/bookings/{token}', { params: { path: { token: (await params).token } } })
  return { title: data ? `Booking ${data.code} · ${data.owner.name}` : 'Halaman tidak ditemukan', robots: { index: false } }
}

const STATUS: Record<string, string> = {
  draft: 'Menunggu konfirmasi pemilik', reserved: 'Dikonfirmasi', picked_up: 'Sedang disewa',
  returned: 'Sudah dikembalikan', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak datang',
}
const INVOICE: Record<string, string> = {
  unpaid: 'Belum dibayar', overdue: 'Lewat tenggat', paid: 'Lunas', cancelled: 'Dibatalkan', gateway_pending: 'Belum dibayar',
}
const DEPOSIT: Record<string, string> = {
  unpaid: 'Belum dibayar — ikut di tagihan', held: 'Dipegang pemilik, kembali setelah selesai',
  waived: 'Dibebaskan pemilik', settled: 'Sudah diselesaikan',
}

/**
 * The renter portal.  (S1-062, BR-002, 04-api-spec.md §3.8.1, §5)
 *
 * One booking, its bills, its photos, its deposit. Paying is one-way in phase 1:
 * transfer, then upload the proof -- there is no pay button, not even a disabled
 * one, and an uploaded proof is never shown as "lunas" until a person approves it.
 */
export default async function Portal({ params }: Props) {
  const { token } = await params
  const { data: b, response } = await (await tenantApi()).GET('/portal/bookings/{token}', { params: { path: { token } } })
  if (response.status === 429) return <RateLimited />
  if (!b) notFound()
  const owed = b.invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'gateway_pending')

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{b.owner.name}</p>
          <h1 className="text-2xl font-bold">Booking {b.code}</h1>
          <p className="mt-1 text-sm">
            <span className="rounded-full bg-stone-200 px-2.5 py-0.5 font-medium">{STATUS[b.status] ?? b.status}</span>
            {b.overdue && <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-800">Terlambat kembali</span>}
          </p>
        </div>
        {b.owner.whatsapp && <WhatsAppButton whatsapp={b.owner.whatsapp} text={`Halo, soal booking ${b.code}.`} primary={false}>Chat pemilik</WhatsAppButton>}
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
        <h2 className="mb-2 font-semibold">Jadwal</h2>
        <p className="font-medium">{b.resource_name}</p>
        <p className="text-stone-600">{formatRange(b.start_at, b.end_at)}</p>
        <p className="text-stone-600">{b.duration_qty} {UNIT_LABEL[b.pricing_unit] ?? ''} · {formatRupiah(b.subtotal)}</p>
        {b.actual_return_at && <p className="mt-1 text-stone-600">Dikembalikan {formatDateTime(b.actual_return_at)}</p>}
        {b.owner.address && <p className="mt-2 text-stone-500">Ambil di: {b.owner.address}</p>}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
        <h2 className="mb-2 font-semibold">Tagihan</h2>
        {b.invoices.length === 0 && (
          <p className="text-stone-600">
            {b.status === 'draft' ? 'Tagihan terbit setelah pemilik mengonfirmasi pengajuanmu.' : 'Belum ada tagihan.'}
          </p>
        )}
        <ul className="space-y-4">
          {b.invoices.map((inv) => (
            <li key={inv.id} className={`rounded-xl border border-stone-200 p-4 ${inv.status === 'cancelled' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{inv.number}</span>
                <span className={inv.status === 'paid' ? 'font-medium text-emerald-700' : inv.status === 'overdue' ? 'font-medium text-red-700' : 'text-stone-600'}>
                  {INVOICE[inv.status] ?? inv.status}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 text-stone-600">
                {inv.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3"><span>{l.description}</span><span>{formatRupiah(l.amount)}</span></li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-stone-100 pt-2 font-semibold">
                <span>Total</span><span>{formatRupiah(inv.total)}</span>
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {inv.paid_at ? `Lunas ${formatDateTime(inv.paid_at)}` : `Bayar sebelum ${formatDateTime(inv.due_at)}`}
              </p>
              {inv.proof_pending && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-900">Bukti transfer sudah dikirim, menunggu dicek pemilik.</p>
              )}
              {!inv.proof_pending && owed.includes(inv) && <ProofUpload token={token} invoiceId={inv.id} />}
            </li>
          ))}
        </ul>
      </section>

      {owed.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
          <h2 className="mb-2 font-semibold">Cara bayar</h2>
          {b.owner.bank ? (
            <>
              <p className="text-stone-600">Transfer ke rekening ini, lalu unggah buktinya di tagihan di atas:</p>
              <p className="mt-2 text-base font-semibold">{b.owner.bank.name} {b.owner.bank.account_number}</p>
              <p className="text-stone-600">a.n. {b.owner.bank.account_holder}</p>
            </>
          ) : (
            <p className="text-stone-600">Minta nomor rekening ke pemilik lewat WhatsApp, lalu unggah bukti transfernya di tagihan di atas.</p>
          )}
          <p className="mt-3 text-xs text-stone-500">Tagihan berubah jadi lunas setelah pemilik mengecek buktinya.</p>
        </section>
      )}

      {b.deposit.state !== 'none' && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
          <h2 className="mb-1 font-semibold">Deposit {b.deposit.amount !== null && formatRupiah(b.deposit.amount)}</h2>
          <p className="text-stone-600">{DEPOSIT[b.deposit.state]}</p>
          {b.deposit.state === 'settled' && (
            <p className="mt-1 text-stone-600">
              Dikembalikan {formatRupiah(b.deposit.refunded ?? 0)}
              {(b.deposit.deducted ?? 0) > 0 && ` · dipotong ${formatRupiah(b.deposit.deducted ?? 0)}`}
            </p>
          )}
        </section>
      )}

      {b.photos.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
          <h2 className="mb-2 font-semibold">Foto kondisi</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {b.photos.map((p, i) => (
              <li key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs, no optimizer */}
                <a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={`Foto ${p.direction === 'pickup' ? 'saat ambil' : 'saat kembali'}`}
                  className="aspect-square w-full rounded-lg object-cover" /></a>
                <span className="mt-0.5 block text-xs text-stone-500">{p.direction === 'pickup' ? 'Ambil' : 'Kembali'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
