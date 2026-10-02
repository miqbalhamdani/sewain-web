'use client'

import {
  Button,
  Card,
  Flex,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import { PageShell } from 'components/layout/PageShell'
import { ConfirmDialog } from 'components/table/ConfirmDialog'
import { useCan } from 'contexts/SessionContext'
import { api, problemCode } from 'lib/api/client'
import { formatDateTime } from 'lib/format/datetime'
import { formatPrice, formatRupiah } from 'lib/format/money'

import { StatusBadges } from '../labels'

const SwapDialog = dynamic(() => import('./SwapDialog'))

/**
 * Satu booking.  (S1-029, S1-032)
 *
 * Aksi muncul hanya untuk status yang mengizinkannya -- "Tukar unit" hilang
 * begitu `picked_up`, bukan muncul lalu gagal (BR-029). Harga dan deposit
 * tidak dirender untuk operator (BR-003).
 */
export default function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const canWrite = useCan('bookings:write')
  const canSeePrices = useCan('pricing:write')
  const [tukar, setTukar] = useState(false)
  const [batal, setBatal] = useState(false)
  const [pesan, setPesan] = useState('')

  const { data: b, isPending, error } = useQuery({
    queryKey: ['bookings', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })

  const aksi = useMutation({
    retry: false,
    mutationFn: async (jenis: 'confirm' | 'cancel') => {
      const opts = { params: { path: { id } } }
      const { error } = jenis === 'confirm'
        ? await api.POST('/bookings/{id}/confirm', opts)
        : await api.POST('/bookings/{id}/cancel', opts)
      if (error) throw error
    },
    onSuccess: () => {
      setBatal(false)
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: (problem) => {
      setBatal(false)
      // Konfirmasi menjalankan ulang cek bentrok (BR-026): draft tidak pernah
      // menahan unit, jadi ia bisa kalah dari booking yang datang belakangan.
      setPesan(problemCode(problem) === 'booking-conflict'
        ? 'Unit ini sudah dipakai booking lain di jadwal yang sama. Tukar unit dulu, atau batalkan draft ini.'
        : 'Aksi gagal. Muat ulang halaman ini.')
    },
  })

  if (isPending) return <PageShell title="Booking"><Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" /></Flex></PageShell>
  if (error !== null || !b) {
    return <PageShell title="Booking"><Card variant="panel" role="alert"><Text>Booking tidak ditemukan.</Text></Card></PageShell>
  }

  return (
    <PageShell
      title={b.code}
      breadcrumb={[{ label: 'Booking', href: '/bookings' }]}
      width="form"
      action={canWrite && (
        <Flex gap="10px" wrap="wrap">
          {b.status === 'draft' && (
            <Button variant="brand" isLoading={aksi.isPending} onClick={() => aksi.mutate('confirm')}>Konfirmasi</Button>
          )}
          {b.status === 'reserved' && (
            <Button variant="outline" onClick={() => setTukar(true)}>Tukar unit</Button>
          )}
          {(b.status === 'draft' || b.status === 'reserved') && (
            <Button variant="outline" colorScheme="red" onClick={() => setBatal(true)}>Batalkan</Button>
          )}
        </Flex>
      )}
    >
      {pesan !== '' && <Card variant="panel" role="alert" mb="20px"><Text fontSize="sm">{pesan}</Text></Card>}
      <Card variant="section">
        <Flex mb="16px"><StatusBadges booking={b} /></Flex>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="16px 24px">
          <Baris label="Penyewa">{b.customer.name} · {b.customer.phone}</Baris>
          <Baris label="Barang & unit">{b.resource.name} · {b.unit.label ? `${b.unit.label} (${b.unit.code})` : b.unit.code}</Baris>
          <Baris label="Mulai">{formatDateTime(b.start_at)}</Baris>
          <Baris label="Selesai">{formatDateTime(b.end_at)}</Baris>
          {b.buffer_minutes > 0 && <Baris label="Unit siap lagi">{formatDateTime(b.end_at_with_buffer)}</Baris>}
          {canSeePrices && (
            <>
              <Baris label="Harga">{formatPrice(b.unit_price, b.pricing_unit)} × {b.duration_qty} = {formatRupiah(b.subtotal)}</Baris>
              <Baris label="Deposit">{b.deposit_amount === null ? 'Tanpa deposit' : formatRupiah(b.deposit_amount)}</Baris>
            </>
          )}
          {b.status === 'cancelled' && <Baris label="Dibatalkan">{b.cancelled_reason === 'manual' ? 'oleh petugas' : 'otomatis oleh sistem'}</Baris>}
        </SimpleGrid>
      </Card>

      {tukar && <SwapDialog booking={b} onClose={() => setTukar(false)} />}
      <ConfirmDialog
        isOpen={batal}
        title={`Batalkan ${b.code}?`}
        body="Unitnya langsung bebas untuk booking lain. Pembatalan tidak bisa diurungkan."
        confirmLabel="Batalkan booking"
        busy={aksi.isPending}
        onCancel={() => setBatal(false)}
        onConfirm={() => aksi.mutate('cancel')}
      />
    </PageShell>
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text fontSize="xs" color="text.secondary">{label}</Text>
      <Text fontSize="sm" color="text.primary" fontWeight="500">{children}</Text>
    </div>
  )
}
