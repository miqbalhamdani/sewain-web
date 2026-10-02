'use client'

import { Badge } from '@chakra-ui/react'

import type { components } from 'lib/api/schema'

type Booking = components['schemas']['Booking']
export type BookingStatus = components['schemas']['BookingStatus']

/** Tujuh status tersimpan. `overdue` bukan salah satunya (BR-041). */
export const STATUS: Record<BookingStatus, { label: string; scheme: string }> = {
  draft: { label: 'draft', scheme: 'gray' },
  reserved: { label: 'dipesan', scheme: 'blue' },
  picked_up: { label: 'sedang disewa', scheme: 'orange' },
  returned: { label: 'sudah kembali', scheme: 'teal' },
  completed: { label: 'selesai', scheme: 'green' },
  cancelled: { label: 'batal', scheme: 'gray' },
  no_show: { label: 'tidak datang', scheme: 'gray' },
}

/**
 * Status plus, kalau berlaku, penanda telat. Telat tampil sebagai badge kedua,
 * bukan menggantikan status: ia kondisi turunan di atas `picked_up` (BR-041).
 */
export function StatusBadges({ booking }: { booking: Pick<Booking, 'status' | 'overdue'> }) {
  const s = STATUS[booking.status]
  return (
    <>
      <Badge colorScheme={s.scheme}>{s.label}</Badge>
      {booking.overdue && <Badge colorScheme="red" ms="6px">terlambat</Badge>}
    </>
  )
}
