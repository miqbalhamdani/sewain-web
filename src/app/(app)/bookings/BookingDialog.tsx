'use client'

import {
  Box,
  Button,
  Card,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatDateTime } from 'lib/format/datetime'
import { formatPrice, formatRupiah } from 'lib/format/money'

import { DepositPanel } from './DepositPanel'
import { HandoverGallery } from './HandoverGallery'
import { InvoiceSummary } from './InvoiceSummary'
import { StatusBadges } from './labels'
import { allowedActions, type BookingAction } from './useBookingActions'

type Booking = Awaited<ReturnType<typeof fetchBooking>>

async function fetchBooking(id: string) {
  const { data, error } = await api.GET('/bookings/{id}', { params: { path: { id } } })
  if (error) throw error
  return data
}

/**
 * Satu booking, sebagai modal di atas daftarnya.  (S1-029, S1-032)
 *
 * Layar penuh di HP, dengan aksi menempel di bawah -- dalam jangkauan ibu jari.
 * Aksi muncul hanya untuk status yang mengizinkannya; harga dan deposit tidak
 * dirender untuk operator (BR-003).
 */
export default function BookingDialog({ id, message, busy, onAction, onClose }: {
  id: string
  /** Pesan gagal aksi terakhir untuk booking ini, kalau ada. */
  message?: string
  busy: boolean
  onAction: (kind: BookingAction, booking: Booking) => void
  onClose: () => void
}) {
  const canWrite = useCan('bookings:write')
  const canHandover = useCan('handovers:write')
  const canSeePrices = useCan('pricing:write')
  const size = useBreakpointValue({ base: 'full', md: 'xl' }) ?? 'xl'
  const full = size === 'full'

  const { data: b, isPending, error } = useQuery({ queryKey: ['bookings', id], queryFn: () => fetchBooking(id) })
  const boleh = b ? allowedActions(b) : null
  const handover = canHandover && boleh !== null && (boleh.pickup || boleh.return)
  const adaAksi = (canWrite && boleh !== null && (boleh.confirm || boleh.swap || boleh.cancel || boleh.complete)) || handover

  return (
    <Modal isOpen onClose={onClose} size={size} isCentered={!full} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius={full ? '0' : '20px'}>
        <ModalHeader pe="56px">
          <Text fontSize="lg" fontWeight="700" color="text.primary">{b?.code ?? 'Booking'}</Text>
          {b && <Flex mt="6px"><StatusBadges booking={b} /></Flex>}
        </ModalHeader>
        <ModalCloseButton top="16px" right="16px" />

        <ModalBody pb="24px">
          {isPending && <Flex py="40px" justify="center"><Spinner size="lg" color="brand.500" /></Flex>}
          {error !== null && !isPending && <Text color="text.primary">Booking tidak ditemukan.</Text>}
          {message && <Card variant="panel" role="alert" mb="16px"><Text fontSize="sm">{message}</Text></Card>}
          {b && (
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
              {b.actual_return_at && <Baris label="Dikembalikan">{formatDateTime(b.actual_return_at)}</Baris>}
            </SimpleGrid>
          )}
          {b && <InvoiceSummary bookingId={b.id} />}
          {b && <DepositPanel booking={b} />}
          {b && (b.status === 'picked_up' || b.status === 'returned' || b.status === 'completed') && (
            <HandoverGallery bookingId={b.id} />
          )}
        </ModalBody>

        {b && adaAksi && boleh && (
          <ModalFooter gap="10px" flexWrap="wrap" borderTopWidth="1px" borderColor="border.subtle"
            pb={full ? 'calc(16px + env(safe-area-inset-bottom))' : undefined}>
            {canWrite && boleh.cancel && (
              <Button variant="outline" colorScheme="red" onClick={() => onAction('cancel', b)} isDisabled={busy}>Batalkan</Button>
            )}
            <Box flex="1" />
            {canWrite && boleh.swap && <Button variant="outline" onClick={() => onAction('swap', b)}>Tukar unit</Button>}
            {canWrite && boleh.complete && (
              <Button variant="brand" isLoading={busy} onClick={() => onAction('complete', b)}>Selesaikan booking</Button>
            )}
            {canWrite && boleh.confirm && (
              <Button variant="brand" isLoading={busy} onClick={() => onAction('confirm', b)}>Konfirmasi</Button>
            )}
            {canHandover && boleh.pickup && (
              <Button variant="brand" onClick={() => onAction('pickup', b)}>Serah-terima ambil</Button>
            )}
            {canHandover && boleh.return && (
              // Outline, bukan brand: modal ini juga terbuka SESAAT setelah
              // ambil, dan "Terima kembali" bukan ajakan untuk detik itu.
              <Button variant="outline" onClick={() => onAction('return', b)}>Terima kembali</Button>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
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
