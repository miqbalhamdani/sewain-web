'use client'

import {
  Button,
  FormControl,
  FormErrorMessage,
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
  Textarea,
} from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { CountField } from 'components/fields/CountField'
import { DateField } from 'components/fields/DateField'
import { SelectField } from 'components/fields/SelectField'
import { api, fieldErrors, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'

import { COLORS, modelYears } from '../../vehiclePresets'

type Unit = components['schemas']['ResourceUnit']

type UnitDialogProps = {
  resourceId: string
  isVehicleRental: boolean

  /**
   * `null` = tambah, sebuah unit = edit.
   *
   * Diisi dari baris yang sudah di tangan, bukan dari permintaan baru: tidak ada
   * `GET /units/{id}` di kontrak sama sekali -- daftarnya dibaca lewat jenis
   * barangnya, dan satu baris dari daftar itu sudah memuat semuanya.
   */
  unit: Unit | null

  isOpen: boolean
  onClose: () => void
}

/**
 * Satu modal untuk tambah DAN edit unit.
 *
 * Form ini dulu menempel di halaman dan memakan separuh layar atas untuk aksi
 * yang dipakai sesekali -- di layar yang tugasnya menampilkan daftar. Ia juga
 * tetap dirender saat barangnya 404, jadi juragan bisa mengisi form yang pasti
 * gagal.
 *
 * Satu komponen untuk dua mode, bukan dua form: yang kedua akan menyimpang dari
 * yang pertama pada field berikutnya yang ditambahkan.
 */
export function UnitDialog({
  resourceId,
  isVehicleRental,
  unit,
  isOpen,
  onClose,
}: UnitDialogProps) {
  const queryClient = useQueryClient()
  const mode = unit === null ? 'tambah' : 'edit'

  const [code, setCode] = useState(unit?.code ?? '')
  const [label, setLabel] = useState(unit?.label ?? '')
  const [year, setYear] = useState(String(unit?.vehicle?.year ?? new Date().getFullYear()))
  const [color, setColor] = useState(unit?.vehicle?.color ?? '')
  const [taxDueOn, setTaxDueOn] = useState(unit?.vehicle?.tax_due_on ?? '')
  const [stnkValidUntil, setStnkValidUntil] = useState(
    unit?.vehicle?.registration_valid_until ?? '',
  )
  // Keduanya diterima kontrak sejak awal dan belum pernah bisa diisi dari layar
  // mana pun -- tidak di form tambah, tidak di mana-mana.
  const [meterValue, setMeterValue] = useState<number | null>(unit?.meter_value ?? null)
  const [conditionNotes, setConditionNotes] = useState(unit?.condition_notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const vehicleBody = () =>
    isVehicleRental
      ? {
          vehicle: {
            year: Number(year),
            color: color === '' ? null : color,
            // Tanggal kosong dikirim null, bukan dihilangkan: `vehicle`
            // mengganti objeknya utuh, jadi yang absen memang berarti tidak
            // ada -- dan itu yang membuat tanggal salah ketik bisa dikosongkan.
            tax_due_on: taxDueOn === '' ? null : taxDueOn,
            registration_valid_until: stnkValidUntil === '' ? null : stnkValidUntil,
          },
        }
      : {}

  const simpan = useMutation({
    retry: false,
    mutationFn: async () => {
      const body = {
        code,
        label: label === '' ? null : label,
        meter_value: meterValue,
        condition_notes: conditionNotes === '' ? null : conditionNotes,
        ...vehicleBody(),
      }

      if (unit === null) {
        const { data, error } = await api.POST('/resources/{id}/units', {
          params: { path: { id: resourceId } },
          body,
        })
        if (error) throw error
        return data
      }

      const { data, error } = await api.PATCH('/units/{id}', {
        params: { path: { id: unit.id } },
        body,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources', resourceId, 'units'] })
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
      onClose()
    },
    onError: (problem) => {
      // Server menyebut field-nya; kalimatnya milik layar ini, dalam bahasa
      // yang dipakai pembacanya. Pembagian yang sama dengan (auth)/register.
      if (problemCode(problem) === 'validation-failed' && 'code' in fieldErrors(problem)) {
        setErrors({ code: 'Plat atau nomor seri ini sudah dipakai unit lain di usaha kamu.' })
        return
      }
      const fields = fieldErrors(problem)
      setErrors(
        Object.keys(fields).length > 0
          ? fields
          : { code: `Unit gagal di${mode === 'tambah' ? 'tambahkan' : 'simpan'}. Coba lagi.` },
      )
    },
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="xl"
      // "outside", bukan "inside": badan modal yang bisa digulir sendiri
      // membuat konteks overflow yang memotong popover kalender di dalamnya.
      scrollBehavior="outside"
      // Menutup lewat overlay saat sudah ada isian berarti kehilangan ketikan
      // tanpa ditanya. Tombol silang dan Esc tetap jalan dan itu disengaja:
      // keduanya tindakan sadar, klik di luar tidak selalu.
      closeOnOverlayClick={code === '' && label === ''}
    >
      <ModalOverlay />
      <ModalContent borderRadius="20px" as="form" onSubmit={(e) => { e.preventDefault(); simpan.mutate() }}>
        <ModalHeader fontSize="lg" fontWeight="700">
          {mode === 'tambah' ? 'Tambah unit' : `Ubah ${unit?.code}`}
        </ModalHeader>
        <ModalCloseButton top="16px" right="16px" />

        <ModalBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
            <FormControl isInvalid={errors.code !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
                Plat / nomor seri
              </FormLabel>
              <Input
                isRequired
                placeholder="B 1234 XY"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <FormErrorMessage>{errors.code}</FormErrorMessage>
            </FormControl>

            <FormControl mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
                Nama panggilan
              </FormLabel>
              <Input
                placeholder="Avanza Putih"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </FormControl>
          </SimpleGrid>

          {isVehicleRental && (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
              <SelectField
                label="Tahun"
                value={year}
                onChange={setYear}
                options={modelYears().map((y) => ({ value: String(y), label: String(y) }))}
                error={errors['vehicle.year']}
              />
              <SelectField
                label="Warna"
                value={color}
                onChange={setColor}
                options={[{ value: '', label: '—' }, ...COLORS.map((c) => ({ value: c, label: c }))]}
              />

              <DateField label="Pajak jatuh tempo" value={taxDueOn} onChange={setTaxDueOn} />
              <DateField
                label="STNK berlaku s.d."
                value={stnkValidUntil}
                onChange={setStnkValidUntil}
              />
            </SimpleGrid>
          )}

          <CountField
            label="Odometer / jam pakai"
            nullable
            emptyMeans="Kosong = belum dicatat."
            value={meterValue}
            onChange={setMeterValue}
            error={errors.meter_value}
          />

          <FormControl mb="4px">
            <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
              Catatan kondisi
            </FormLabel>
            <Textarea
              minH="80px"
              placeholder="Baret halus di pintu kiri belakang."
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter gap="12px">
          <Button type="button" variant="outline" onClick={onClose} isDisabled={simpan.isPending}>
            Batal
          </Button>
          <Button type="submit" variant="brand" isLoading={simpan.isPending}>
            {mode === 'tambah' ? 'Tambah unit' : 'Simpan perubahan'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
