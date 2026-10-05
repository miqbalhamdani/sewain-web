'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api, problemCode } from 'lib/api/client'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
type ProofType = (typeof TYPES)[number]

/**
 * Upload one transfer proof.  (S1-062, BR-062, BR-093)
 *
 * Presign through the portal token, PUT straight to storage, hand the key in.
 * The answer is 202 -- received, not paid -- and the copy says so.
 */
export function ProofUpload({ token, invoiceId }: { token: string; invoiceId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')

  async function upload(file: File) {
    setError('')
    if (!TYPES.includes(file.type as ProofType) || file.size > 10 * 1024 * 1024) {
      setError('Pilih foto (JPG, PNG, WebP) atau PDF, maksimal 10 MB.')
      return
    }
    setState('busy')
    const path = { token }
    const signed = await api.POST('/portal/bookings/{token}/uploads', {
      params: { path }, body: { content_type: file.type as ProofType, bytes: file.size } })
    const put = signed.data && await fetch(signed.data.upload_url, { method: 'PUT', headers: signed.data.headers, body: file })
      .catch((): null => null)
    const handed = put?.ok && await api.POST('/portal/bookings/{token}/proofs', {
      params: { path }, body: { invoice_id: invoiceId, object_key: signed.data.object_key } })
    if (handed && handed.response.status === 202) {
      setState('done')
      router.refresh()
      return
    }
    setState('idle')
    const problem = signed.error ?? (handed ? handed.error : null)
    setError(problemCode(problem) === 'rate-limited'
      ? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
      : 'Bukti gagal terkirim. Periksa koneksimu lalu coba lagi.')
  }

  if (state === 'done') {
    return <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-900">Bukti terkirim, menunggu dicek pemilik.</p>
  }
  return (
    <div className="mt-3">
      <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-700 ${state === 'busy' ? 'opacity-60' : ''}`}>
        {state === 'busy' ? 'Mengunggah…' : 'Unggah bukti transfer'}
        <input type="file" accept={TYPES.join(',')} className="sr-only" disabled={state === 'busy'}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
