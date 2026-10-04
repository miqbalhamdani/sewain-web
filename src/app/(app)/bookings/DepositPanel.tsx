'use client'

import { Box, Button, Flex, FormControl, FormLabel, Heading, Text, Textarea } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { useCan } from 'contexts/SessionContext'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type Booking = components['schemas']['Booking']

/**
 * Deposit: penyelesaian dan pembebasan.  (S1-048, BR-048 .. BR-051)
 *
 * Not rendered at all for a booking without a deposit (BR-016). Settling is
 * after return; the deposit absorbs the return charges, and a shortfall shows
 * as a new invoice above -- never as a negative deposit. Waiving is the
 * owner's, before the deposit is paid, and is not rendered for an operator.
 */
export function DepositPanel({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient()
  const canSettle = useCan('bookings:write')
  const canWaive = useCan('deposits:waive')
  const [note, setNote] = useState('')
  const [waiving, setWaiving] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const { data: p } = useQuery({
    queryKey: ['bookings', booking.id, 'deposit'],
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}/deposit', { params: { path: { id: booking.id } } })
      if (error) throw error
      return data
    },
  })

  const aksi = useMutation({
    retry: false,
    mutationFn: async (kind: 'settle' | 'waive') => {
      const opts = { params: { path: { id: booking.id }, header: { 'Idempotency-Key': crypto.randomUUID() } } }
      const { error } = kind === 'settle'
        ? await api.POST('/bookings/{id}/deposit/settle', { ...opts, body: note.trim() !== '' ? { note: note.trim() } : {} })
        : await api.POST('/bookings/{id}/deposit/waive', { ...opts, body: { reason: reason.trim() } })
      if (error) throw error
    },
    onSuccess: () => { setWaiving(false); void queryClient.invalidateQueries({ queryKey: ['bookings'] }) },
    onError: (problem) => setError({
      'deposit-not-collected': 'Deposit belum dibayar — catat pembayaran invoice-nya dulu, atau bebaskan depositnya.',
      'deposit-already-paid': 'Deposit sudah dibayar, jadi tidak bisa dibebaskan lagi. Kembalikan lewat penyelesaian.',
      'deposit-not-applicable': 'Booking ini tidak punya deposit untuk diproses.',
      'waiver-reason-required': 'Tulis alasan pembebasan.',
    }[problemCode(problem)] ?? 'Gagal. Coba lagi.'),
  })

  if (booking.deposit_amount === null) return null // BR-016
  if (!p) return null

  if (p.waived) {
    return (
      <Box>
        <Heading as="h2" size="sm" tabIndex={-1} mb="6px">Deposit</Heading>
        <Text fontSize="sm" color="text.secondary">Dibebaskan {booking.deposit_waived_at ? formatDateTime(booking.deposit_waived_at) : ''}.</Text>
      </Box>
    )
  }

  const settled = booking.deposit_settled_at !== null
  const canWaiveNow = canWaive && !p.collected && booking.status !== 'cancelled' && booking.status !== 'completed'
  const canSettleNow = canSettle && booking.status === 'returned' && !settled

  return (
    <Box>
      {/* h2 yang bisa difokus: tombol "Selesaikan deposit" di kartu langkah
          menggulir ke sini dan menaruh fokus di judul ini. */}
      <Heading as="h2" size="sm" tabIndex={-1} mb="8px">Deposit {formatRupiah(p.deposit_amount ?? 0)}</Heading>
      {settled ? (
        <Text fontSize="sm" color="text.secondary">
          Diselesaikan {formatDateTime(booking.deposit_settled_at!)}: dipotong {formatRupiah(booking.deposit_deducted)},
          dikembalikan {formatRupiah(booking.deposit_refunded)}.
        </Text>
      ) : (
        <Text fontSize="sm" color="text.secondary">{p.collected ? 'Sudah dibayar penyewa.' : 'Belum dibayar.'}</Text>
      )}

      {canSettleNow && (
        <Box mt="10px" borderWidth="1px" borderColor="border.subtle" borderRadius="12px" p="12px">
          <Flex justify="space-between" fontSize="sm"><Text color="text.secondary">Potongan (denda & kerusakan)</Text><Text>{formatRupiah(p.deductions)}</Text></Flex>
          <Flex justify="space-between" fontSize="sm"><Text color="text.secondary">Diambil dari deposit</Text><Text>{formatRupiah(p.deducted_amount)}</Text></Flex>
          <Flex justify="space-between" fontSize="sm" fontWeight="700"><Text>Dikembalikan ke penyewa</Text><Text>{formatRupiah(p.refund_amount)}</Text></Flex>
          {p.new_invoice_amount > 0 && (
            // BR-048: the shortfall is a new invoice, not a negative deposit.
            <Text fontSize="sm" color="orange.500" mt="6px">
              Deposit tidak cukup — invoice baru {formatRupiah(p.new_invoice_amount)} akan terbit untuk sisanya.
            </Text>
          )}
          {p.deductions > 0 && (
            <FormControl mt="10px" isRequired>
              <FormLabel fontSize="sm">Catatan potongan</FormLabel>
              <Textarea size="sm" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                placeholder="Denda telat 2 hari dan baret pintu." />
            </FormControl>
          )}
          <Button mt="10px" size="sm" variant="brand" isLoading={aksi.isPending}
            isDisabled={!p.collected || (p.deductions > 0 && note.trim() === '')}
            onClick={() => { setError(''); aksi.mutate('settle') }}>
            Selesaikan deposit
          </Button>
          {!p.collected && <Text fontSize="sm" color="text.secondary" mt="4px">Bisa diselesaikan setelah deposit dibayar.</Text>}
        </Box>
      )}

      {canWaiveNow && !waiving && (
        // Tombol, bukan tautan: aksi yang menghapus tagihan harus terlihat
        // sebagai tombol, dan tautan tidak punya sasaran sentuh 44px.
        <Button mt="10px" size="sm" variant="outline" colorScheme="red" onClick={() => setWaiving(true)}>Bebaskan deposit</Button>
      )}
      {waiving && (
        <Box mt="10px">
          <Textarea size="sm" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
            placeholder="Alasan, mis. pelanggan tetap sejak 2024" />
          <Flex gap="8px" mt="6px">
            <Button size="sm" variant="outline" onClick={() => setWaiving(false)}>Batal</Button>
            <Button size="sm" variant="outline" colorScheme="red" isDisabled={reason.trim() === ''}
              isLoading={aksi.isPending} onClick={() => { setError(''); aksi.mutate('waive') }}>Bebaskan</Button>
          </Flex>
        </Box>
      )}
      {error !== '' && <Text role="alert" fontSize="sm" color="red.500" mt="6px">{error}</Text>}
    </Box>
  )
}
