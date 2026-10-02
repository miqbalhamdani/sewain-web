import { redirect } from 'next/navigation'

/**
 * Alamat lama satu booking. Detailnya sekarang modal di atas daftar
 * (`/bookings?id=…`); alamat ini tetap hidup supaya tautan yang sudah tersebar
 * -- dan alur serah-terima M3 -- punya tujuan yang stabil.
 */
export default async function BookingRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/bookings?id=${encodeURIComponent(id)}`)
}
