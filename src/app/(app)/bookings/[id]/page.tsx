'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { BookingDetail } from './BookingDetail'

/**
 * Satu booking, sebagai halaman.  (S1-029, S1-032)
 *
 * Dulu alamat ini cuma mengalihkan ke modal di atas daftar (`/bookings?id=…`).
 * Sekarang ia halamannya sendiri -- alasannya di BookingDetail -- dan tautan
 * lama yang sudah tersebar tetap mendarat di tempat yang benar.
 */
export default function BookingPage() {
  // useSearchParams menuntut Suspense di atasnya saat `next build`.
  return <Suspense><Detail /></Suspense>
}

function Detail() {
  const { id } = useParams<{ id: string }>()
  const err = useSearchParams().get('err')
  return <BookingDetail id={id} initialError={err} />
}
