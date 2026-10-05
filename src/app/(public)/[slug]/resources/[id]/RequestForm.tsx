'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useIdempotencyKey } from 'hooks/useIdempotencyKey'
import { api, problemCode } from 'lib/api/client'
import { fromJakartaLocal } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type Availability = { available: boolean; count: number; qty: number; subtotal: number; unit: string } | null

const input = 'h-11 w-full rounded-xl border border-stone-300 bg-white px-3'

/**
 * The request form.  (S1-061, BR-026, BR-028)
 *
 * What it makes is a draft that holds nothing, and the copy says exactly that:
 * "menunggu konfirmasi pemilik", never "booking berhasil". A blocked renter hears
 * the same neutral sentence the API sends -- never that, or why, they are blocked.
 */
export function RequestForm({ resourceId, mulai: m0, selesai: s0, whatsapp, availability }: {
  resourceId: string; mulai: string; selesai: string; whatsapp: string; availability: Availability
}) {
  const router = useRouter()
  const [key, renewKey] = useIdempotencyKey()
  const [mulai, setMulai] = useState(m0)
  const [selesai, setSelesai] = useState(s0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ code: string; trackUrl: string } | null>(null)
  const checked = availability !== null && mulai === m0 && selesai === s0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: problem, response } = await api.POST('/public/bookings', {
      params: { header: { 'Idempotency-Key': key } },
      body: { resource_id: resourceId, start_at: fromJakartaLocal(mulai), end_at: fromJakartaLocal(selesai),
        customer: { name: name.trim(), phone: phone.replace(/[\s-]/g, '') } },
    })
    setBusy(false)
    if (data) {
      setDone({ code: data.code, trackUrl: data.track_url })
      return
    }
    const code = problemCode(problem)
    // The same key for a retry of this intent; a real refusal is a new intent next time.
    if (code !== 'request-in-flight' && response.status < 500) renewKey()
    setError({
      'booking-conflict': 'Tidak ada unit yang kosong di jam itu. Coba jam lain.',
      'customer-blacklisted': 'Pengajuan tidak dapat diproses. Silakan hubungi pemilik.',
      'duration-out-of-range': 'Lama sewa di luar batas barang ini. Lihat batasnya di atas.',
      'rate-limited': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
      'request-in-flight': 'Pengajuanmu sedang diproses. Tunggu sebentar, jangan tekan lagi.',
      'validation-failed': 'Periksa lagi tanggal, nama, dan nomor WhatsApp-nya. Tanggal mulai harus belum lewat.',
    }[code] ?? 'Pengajuan gagal terkirim. Coba lagi.')
  }

  if (done) {
    return (
      <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="font-semibold text-emerald-900">Pengajuan terkirim, menunggu konfirmasi pemilik</h2>
        <p className="mt-1 text-sm text-emerald-900">
          Kode <strong>{done.code}</strong>. Unit belum dipesankan untukmu sampai pemilik mengonfirmasi —
          pemilik akan menghubungimu.
        </p>
        <a href={done.trackUrl} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
          Pantau pengajuan
        </a>
        <p className="mt-2 text-xs text-emerald-800">Simpan tautan itu — di sana tagihan dan cara bayar muncul setelah dikonfirmasi.</p>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Ajukan sewa</h2>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Mulai</span>
        <input type="datetime-local" required value={mulai} onChange={(e) => setMulai(e.target.value)} className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Selesai</span>
        <input type="datetime-local" required value={selesai} onChange={(e) => setSelesai(e.target.value)} className={input} />
      </label>
      {checked ? (
        <p className={`text-sm font-medium ${availability.available ? 'text-emerald-700' : 'text-red-700'}`}>
          {availability.available
            ? `Tersisa ${availability.count} unit · ${availability.qty} ${availability.unit} ${formatRupiah(availability.subtotal)}`
            : 'Penuh di jam itu — coba jam lain.'}
        </p>
      ) : (
        <button type="button" onClick={() => router.replace(`?mulai=${mulai}&selesai=${selesai}`, { scroll: false })}
          className="text-sm font-medium text-stone-700 underline underline-offset-2">
          Cek ketersediaan untuk jam ini
        </button>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nama</span>
        <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nomor WhatsApp</span>
        <input required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812…"
          pattern="(\+62|0)[0-9\s\-]{8,16}" autoComplete="tel" className={input} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}{' '}
          {error.startsWith('Pengajuan tidak dapat') && (
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} className="underline">Hubungi pemilik</a>
          )}
        </p>
      )}
      <button type="submit" disabled={busy}
        className="h-11 w-full rounded-xl bg-stone-900 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60">
        {busy ? 'Mengirim…' : 'Kirim pengajuan'}
      </button>
      <p className="text-xs text-stone-500">Belum mengunci unit. Pemilik mengonfirmasi dulu, lalu tagihan terbit.</p>
    </form>
  )
}
