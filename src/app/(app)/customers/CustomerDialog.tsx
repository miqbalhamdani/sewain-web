'use client'

import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
} from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { SelectField } from 'components/fields/SelectField'

import { api, fieldErrors } from 'lib/api/client'
import type { components } from 'lib/api/schema'

import { IdentityPhotoField } from './IdentityPhotoField'

type Customer = components['schemas']['Customer']
type IdType = components['schemas']['IdType']

export const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'ktp', label: 'KTP' },
  { value: 'sim', label: 'SIM' },
  { value: 'passport', label: 'Paspor' },
]

/** Kata-kata milik layar ini; `detail` server berbahasa Inggris. */
const PESAN: Record<string, string> = {
  name: 'Nama wajib diisi.',
  phone: 'Nomor telepon wajib diisi.',
  id_type: 'Pilih jenis identitasnya dulu — nomor tanpa jenis tidak bisa dicocokkan.',
}

/**
 * Tambah / ubah penyewa.  (S1-031)
 *
 * Nomor identitas tidak pernah diisi ulang dari server: server tidak pernah
 * mengirimnya (BR-085). Saat mengubah, kotaknya kosong dan menyebut empat digit
 * terakhir yang tersimpan; mengosongkannya berarti "biarkan", bukan "hapus".
 */
export default function CustomerDialog({
  isOpen,
  onClose,
  customer,
  onSaved,
  onCloseComplete,
}: {
  isOpen: boolean
  onClose: () => void
  /** Sesudah animasi tutup selesai -- lihat hooks/useDialogState. */
  onCloseComplete?: () => void
  customer: Customer | null
  onSaved?: (c: Customer) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [idType, setIdType] = useState<string>(customer?.id_type ?? '')
  const [idNumber, setIdNumber] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const simpan = useMutation({
    retry: false,
    mutationFn: async () => {
      // Field kosong DIHILANGKAN, bukan dikirim null (CLAUDE.md).
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        ...(idType !== '' ? { id_type: idType as IdType } : {}),
        ...(idNumber.trim() !== '' ? { id_number: idNumber.trim() } : {}),
      }
      if (customer === null) {
        const { data, error } = await api.POST('/customers', { body })
        if (error) throw error
        return data
      }
      const { data, error } = await api.PATCH('/customers/{id}', {
        params: { path: { id: customer.id } },
        body,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      onSaved?.(data)
      onClose()
    },
    onError: (problem) => {
      const fields = fieldErrors(problem)
      const lokal = Object.fromEntries(Object.keys(fields).map((f) => [f, PESAN[f] ?? fields[f]]))
      setErrors(Object.keys(lokal).length > 0 ? lokal : { name: 'Penyewa gagal disimpan. Coba lagi.' })
    },
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} onCloseComplete={onCloseComplete} isCentered size="xl" scrollBehavior="outside"
      closeOnOverlayClick={name === '' && phone === ''}>
      <ModalOverlay />
      <ModalContent borderRadius="20px" as="form"
        onSubmit={(e) => { e.preventDefault(); setErrors({}); simpan.mutate() }}>
        <ModalHeader fontSize="lg" fontWeight="700">
          {customer === null ? 'Tambah penyewa' : `Ubah ${customer.name}`}
        </ModalHeader>
        <ModalCloseButton top="16px" right="16px" />
        <ModalBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
            <FormControl isInvalid={errors.name !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Nama</FormLabel>
              <Input isRequired value={name} onChange={(e) => setName(e.target.value)} placeholder="Budi Santoso" />
              <FormErrorMessage>{errors.name}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={errors.phone !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Telepon / WhatsApp</FormLabel>
              <Input isRequired type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812 3456 7890" />
              <FormErrorMessage>{errors.phone}</FormErrorMessage>
            </FormControl>
            <SelectField
              label="Jenis identitas"
              value={idType}
              onChange={setIdType}
              options={[{ value: '', label: '—' }, ...ID_TYPES]}
              error={errors.id_type}
            />
            <FormControl mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Nomor identitas</FormLabel>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} autoComplete="off"
                placeholder={customer?.id_number_last4 ? `tersimpan: …${customer.id_number_last4}` : ''} />
              <FormHelperText fontSize="xs">
                Disimpan terenkripsi. Setelah disimpan hanya empat digit terakhirnya yang tampil.
              </FormHelperText>
            </FormControl>
          </SimpleGrid>
          {customer !== null && <IdentityPhotoField customer={customer} idType={idType} />}
        </ModalBody>
        <ModalFooter gap="12px">
          <Button type="button" variant="outline" onClick={onClose} isDisabled={simpan.isPending}>Batal</Button>
          <Button type="submit" variant="brand" isLoading={simpan.isPending}>
            {customer === null ? 'Tambah penyewa' : 'Simpan perubahan'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
