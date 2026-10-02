'use client'

import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type Customer = components['schemas']['Customer']

/**
 * Blokir atau buka blokir.  (S1-031, BR-028)
 *
 * Hanya dirender untuk yang punya `customers:blacklist` -- pemanggilnya yang
 * menjaga. Alasan wajib: operator yang ditolak sistem membacanya, dan blokir
 * tanpa alasan tidak bisa dijelaskan ke penyewanya.
 */
export default function BlacklistDialog({ customer, isOpen = true, onClose, onCloseComplete }: {
  customer: Customer
  isOpen?: boolean
  onClose: () => void
  /** Sesudah animasi tutup selesai -- lihat hooks/useDialogState. */
  onCloseComplete?: () => void
}) {
  const queryClient = useQueryClient()
  const blokir = !customer.is_blacklisted
  const [alasan, setAlasan] = useState('')
  const [error, setError] = useState('')

  const kirim = useMutation({
    retry: false,
    mutationFn: async () => {
      const opts = { params: { path: { id: customer.id } } }
      const { error } = blokir
        ? await api.POST('/customers/{id}/blacklist', { ...opts, body: { reason: alasan.trim() } })
        : await api.DELETE('/customers/{id}/blacklist', opts)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    },
    onError: () => setError(blokir ? 'Alasan wajib diisi.' : 'Gagal membuka blokir. Coba lagi.'),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} onCloseComplete={onCloseComplete} isCentered>
      <ModalOverlay />
      <ModalContent borderRadius="20px" as="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (blokir && alasan.trim() === '') return setError('Alasan wajib diisi.')
          kirim.mutate()
        }}>
        <ModalHeader fontSize="lg" fontWeight="700">
          {blokir ? `Blokir ${customer.name}?` : `Buka blokir ${customer.name}?`}
        </ModalHeader>
        <ModalBody>
          <Text fontSize="sm" color="text.secondary" mb="16px">
            {blokir
              ? 'Booking yang sudah ada tidak dibatalkan. Yang ditolak hanya booking baru, dan operator akan melihat alasan ini.'
              : 'Penyewa ini bisa dibooking lagi. Alasan blokir sebelumnya ikut dihapus.'}
          </Text>
          {blokir && (
            <FormControl isInvalid={error !== ''}>
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Alasan</FormLabel>
              <Textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={500}
                placeholder="Unit kembali penyok dan menolak membayar perbaikan." />
              <FormErrorMessage>{error}</FormErrorMessage>
            </FormControl>
          )}
        </ModalBody>
        <ModalFooter gap="12px">
          <Button type="button" variant="brand" onClick={onClose} minW="88px">Tidak</Button>
          <Button type="submit" variant="outline" colorScheme={blokir ? 'red' : 'brand'} isLoading={kirim.isPending} minW="88px">
            Ya
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
