'use client'

import { useToast } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState, type ReactNode } from 'react'

import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type Booking = components['schemas']['Booking']
export type BookingAction = 'confirm' | 'swap' | 'cancel' | 'pickup' | 'return' | 'complete'

const SwapDialog = dynamic(() => import('./SwapDialog'))
const ConfirmDialog = dynamic(
  () => import('components/table/ConfirmDialog').then((m) => m.ConfirmDialog),
  { ssr: false },
)

/**
 * Aksi yang boleh untuk status ini (BR-029: tukar hilang begitu `picked_up`).
 * Ambil juga terbuka untuk `no_show` -- penyewa yang datang terlambat tidak
 * ditolak langsung (BR-057).
 */
export function allowedActions(
  b: Pick<Booking, 'status' | 'deposit_amount' | 'deposit_waived_at' | 'deposit_settled_at'>,
): Record<BookingAction, boolean> {
  return {
    // BR-049: not rendered before the deposit is settled -- a button that can
    // only 409 is not an action. No deposit, or a waived one, never blocks.
    complete: b.status === 'returned' &&
      (b.deposit_amount === null || b.deposit_waived_at !== null || b.deposit_settled_at !== null),
    confirm: b.status === 'draft',
    swap: b.status === 'reserved',
    cancel: b.status === 'draft' || b.status === 'reserved',
    pickup: b.status === 'reserved' || b.status === 'no_show',
    return: b.status === 'picked_up',
  }
}

/**
 * Konfirmasi, tukar unit, dan batalkan -- satu tempat untuk menu baris dan
 * modal detail, supaya pesan error dan dialog konfirmasinya tidak ditulis dua kali.
 *
 * Gagal TIDAK berakhir sebagai toast: pesannya dikembalikan lewat `onError` dan
 * pemanggil membuka modal booking itu, karena "unit sudah dipakai booking lain"
 * butuh konteks, bukan kotak yang hilang dalam lima detik.
 */
export function useBookingActions({ onError }: { onError: (bookingId: string, message: string) => void }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const toast = useToast()
  const [swapping, setSwapping] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState<Booking | null>(null)

  // Unduh kode dialognya sesudah layar tampil, bukan saat tombolnya ditekan:
  // tanpa ini klik pertama menunggu satu chunk, dan jedanya terlihat sebagai kedip.
  useEffect(() => {
    void import('./SwapDialog')
    void import('components/table/ConfirmDialog')
  }, [])

  const aksi = useMutation({
    retry: false,
    mutationFn: async ({ jenis, booking }: { jenis: 'confirm' | 'cancel' | 'complete'; booking: Booking }) => {
      const opts = { params: { path: { id: booking.id } } }
      const { error } = jenis === 'confirm'
        ? await api.POST('/bookings/{id}/confirm', opts)
        : jenis === 'complete'
          ? await api.POST('/bookings/{id}/complete', {
            params: { path: { id: booking.id }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
          : await api.POST('/bookings/{id}/cancel', opts)
      if (error) throw error
    },
    onSuccess: (_, { jenis, booking }) => {
      setCancelling(null)
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast({ status: 'success', duration: 4000,
        title: `${booking.code} ${{ confirm: 'dikonfirmasi', cancel: 'dibatalkan', complete: 'selesai' }[jenis]}` })
    },
    onError: (problem, { booking }) => {
      setCancelling(null)
      // Konfirmasi menjalankan ulang cek bentrok (BR-026): draft tidak pernah
      // menahan unit, jadi ia bisa kalah dari booking yang datang belakangan.
      onError(booking.id, problemCode(problem) === 'booking-conflict'
        ? 'Unit ini sudah dipakai booking lain di jadwal yang sama. Tukar unit dulu, atau batalkan draft ini.'
        : 'Aksi gagal. Coba lagi.')
    },
  })

  function start(kind: BookingAction, booking: Booking) {
    // Serah-terima adalah alur layar penuh, bukan dialog: kamera, odometer,
    // dan tombol di bawah ibu jari (S1-037).
    if (kind === 'pickup' || kind === 'return') router.push(`/bookings/${booking.id}/${kind}`)
    else if (kind === 'confirm') aksi.mutate({ jenis: 'confirm', booking })
    else if (kind === 'complete') aksi.mutate({ jenis: 'complete', booking })
    else if (kind === 'swap') setSwapping(booking)
    else setCancelling(booking)
  }

  // Suspense sendiri: render pertama dialog lazy menunggu chunk-nya. Tanpa batas
  // di sini yang menunggu adalah Suspense halaman daftar -- seluruh daftar
  // hilang sesaat pada klik pertama "Tukar unit".
  const dialogs: ReactNode = (
    <Suspense fallback={null}>
      {swapping && (
        <SwapDialog booking={swapping} onClose={() => setSwapping(null)}
          onSwapped={(unit) => toast({ status: 'success', duration: 4000, title: `${swapping.code}: unit ditukar${unit ? ` ke ${unit}` : ''}` })} />
      )}
      {cancelling && (
        <ConfirmDialog
          isOpen
          title={`Batalkan ${cancelling.code}?`}
          body="Unitnya langsung bebas untuk booking lain. Pembatalan tidak bisa diurungkan."
          busy={aksi.isPending}
          onCancel={() => setCancelling(null)}
          onConfirm={() => aksi.mutate({ jenis: 'cancel', booking: cancelling })}
        />
      )}
    </Suspense>
  )

  // Satu modal pada satu waktu: Chakra tidak menumpuk aria-hidden dua modal
  // dengan benar ("aria-hidden … not contained inside …"), dan dua overlay
  // bertumpuk terlihat sebagai kedip. Pemanggil menyembunyikan modal detail
  // selama `active`.
  return { start, pending: aksi.isPending, active: swapping !== null || cancelling !== null, dialogs }
}
