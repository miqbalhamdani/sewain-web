'use client'

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type Booking = components['schemas']['Booking']

/**
 * Tukar unit.  (S1-032, BR-029)
 *
 * Pilihannya hanya unit dari jenis barang yang sama yang kosong di jadwal
 * booking ini -- database juga menolak yang lain, jadi ini bukan satu-satunya
 * penjaga, cuma yang membuat penolakan itu tidak pernah terlihat.
 */
export default function SwapDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [unitId, setUnitId] = useState('')
  const [error, setError] = useState('')

  const pilihan = useQuery({
    queryKey: ['availability', booking.resource.id, booking.start_at, booking.end_at],
    queryFn: async () => {
      const { data, error } = await api.GET('/availability', {
        params: { query: { resource_id: booking.resource.id, start_at: booking.start_at, end_at: booking.end_at } },
      })
      if (error) throw error
      return data.data[0]?.available_units ?? []
    },
  })

  const tukar = useMutation({
    retry: false,
    mutationFn: async () => {
      const { error } = await api.PATCH('/bookings/{id}', {
        params: { path: { id: booking.id } },
        body: { resource_unit_id: unitId },
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      onClose()
    },
    onError: (problem) => {
      setError(
        problemCode(problem) === 'booking-conflict'
          ? 'Unit itu baru saja dipakai booking lain. Pilih unit lain.'
          : problemCode(problem) === 'unit-not-swappable'
            ? 'Booking ini sudah tidak bisa ditukar unitnya.'
            : 'Gagal menukar unit. Coba lagi.',
      )
      void pilihan.refetch()
    },
  })

  return (
    <Modal isOpen onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent borderRadius="20px">
        <ModalHeader fontSize="lg" fontWeight="700">Tukar unit {booking.code}</ModalHeader>
        <ModalCloseButton top="16px" right="16px" />
        <ModalBody>
          <Text fontSize="sm" color="text.secondary" mb="14px">
            Sekarang: {booking.unit.label ?? booking.unit.code}. Harga tidak berubah — jenis barangnya tetap.
          </Text>
          {pilihan.isPending && <Spinner size="sm" />}
          {pilihan.data?.length === 0 && (
            <Text fontSize="sm" color="text.secondary">Tidak ada unit {booking.resource.name} lain yang kosong di jadwal ini.</Text>
          )}
          <RadioGroup value={unitId} onChange={setUnitId}>
            <Stack>
              {pilihan.data?.map((u) => (
                <Radio key={u.id} value={u.id}>{u.label ? `${u.label} (${u.code})` : u.code}</Radio>
              ))}
            </Stack>
          </RadioGroup>
          {error !== '' && <Text role="alert" mt="12px" fontSize="sm" color="red.500">{error}</Text>}
        </ModalBody>
        <ModalFooter gap="12px">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button variant="brand" isDisabled={unitId === ''} isLoading={tukar.isPending} onClick={() => tukar.mutate()}>
            Tukar unit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
