'use client'

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCan } from 'contexts/SessionContext'
import { api, fieldErrors, problemCode } from 'lib/api/client'
import { formatPrice } from 'lib/format/money'

import { FormSection } from 'components/fields/FormSection'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'

import { ResourceForm, draftOf, localiseErrors, type ResourceDraft } from '../ResourceForm'

/** Jejak yang sama untuk ketiga keadaan layar ini: muat, tidak ketemu, dan isi. */
// Labelnya 'Barang', sama persis dengan yang tertulis di sidebar (routes.tsx):
// jejak yang menyebut modul dengan kata lain daripada tombol yang membawa ke
// sana membuat juragan mengira itu dua tempat.
const KATALOG = [{ label: 'Barang', href: '/catalog' }]

/** Teks kosong berarti tidak ada, dan `null` yang mengatakannya (BR-095). */
function orNull(v: string): string | null {
  return v.trim() === '' ? null : v
}

/** Satuan harga dalam bahasa juragan, untuk kalimat otomatis 5a (BR-095). */
const UNIT_LABEL: Record<string, string> = {
  hour: 'jam',
  day: 'hari',
  week: 'minggu',
  month: 'bulan',
}

/**
 * One kind of thing: read for an operator, editable for an owner.  (S1-018)
 *
 * An operator gets a read-only card with no price, deposit or late fee on it at
 * all -- BR-003 wants the fields gone, not greyed out, and a disabled input
 * still shows the number.
 */
export default function ResourcePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const canWrite = useCan('resources:write')
  const canSeePrices = useCan('pricing:write')


  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState('')

  const { data: resource, isPending } = useQuery({
    queryKey: ['resources', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources/{id}', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })

  const update = useMutation({
    retry: false,
    mutationFn: async (draft: ResourceDraft) => {
      const { data, error } = await api.PATCH('/resources/{id}', {
        params: { path: { id } },
        body: {
          name: draft.name,
          base_price: draft.base_price ?? 0,
          // All four sent every time, value or null. This screen shows all of
          // them, so what it submits is what the resource should have --
          // and null is how "no deposit any more" is said (BR-016).
          deposit_amount: draft.deposit_amount,
          late_fee_per_unit: draft.late_fee_per_unit,
          min_duration: draft.min_duration,
          max_duration: draft.max_duration,
          buffer_minutes: draft.buffer_minutes ?? 0,
          requires_id_verification: draft.requires_id_verification,
          status: draft.status,

          description: orNull(draft.description),
          terms_excludes: orNull(draft.terms_excludes),
          terms_requirements: orNull(draft.terms_requirements),
          terms_cancellation: orNull(draft.terms_cancellation),

          // `vehicle_type` sengaja tidak ikut: ia dikunci sesudah resource
          // dibuat, dan skema PATCH memang tidak punya field-nya (BR-094).
          ...(draft.vehicle
            ? {
                vehicle: {
                  transmission: draft.vehicle.transmission,
                  seats: draft.vehicle.seats,
                  fuel: draft.vehicle.fuel,
                },
              }
            : {}),
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
      setErrors({})
      setFormError('')
      // BR-014: the price change reached no existing booking, and the owner is
      // told how many kept the old one rather than left to guess.
      setSaved(
        updated.active_bookings > 0
          ? `Tersimpan. ${updated.active_bookings} booking yang sedang berjalan tetap memakai harga lama.`
          : 'Tersimpan.',
      )
    },
    onError: (problem) => {
      setSaved('')
      setErrors({})
      setFormError('')
      const fields = fieldErrors(problem)
      if (Object.keys(fields).length > 0) {
        setErrors(localiseErrors(fields))
        return
      }
      setFormError(
        problemCode(problem) === 'permission-denied'
          ? 'Akun kamu tidak bisa mengubah barang.'
          : 'Perubahan gagal disimpan. Periksa isian kamu lalu coba lagi.',
      )
    },
  })

  if (isPending) {
    return (
      <PageShell width="form-aside" title="Barang" breadcrumb={KATALOG}>
        <Flex py="60px" justify="center">
          <Spinner size="lg" color="brand.500" thickness="3px" />
        </Flex>
      </PageShell>
    )
  }

  if (!resource) {
    return (
      <PageShell width="form-aside" title="Barang tidak ditemukan" breadcrumb={KATALOG}>
        <EmptyState
          title="Barang ini tidak ada di usaha kamu"
          description="Mungkin sudah dihapus, atau tautannya milik usaha lain."
          action={
            <Button as={Link} href="/catalog" variant="brand" mx="auto">
              Kembali ke daftar barang
            </Button>
          }
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      width="form-aside"
      breadcrumb={KATALOG}
      title={resource.name}
      subtitle={
        resource.unit_count === 0
          ? 'Belum ada unit aktif — barang ini belum bisa dibooking.'
          : `${resource.unit_count} unit aktif`
      }
    >
      {saved !== '' && (
        <Card mb="20px" role="status">
          <Text color="text.primary" fontSize="sm">
            {saved}
          </Text>
        </Card>
      )}

      {canWrite ? (
        <ResourceForm
          aside={<Kelengkapan id={id} unitCount={resource.unit_count} />}
          initial={draftOf(resource)}
          unitLabel={UNIT_LABEL[resource.pricing_unit]}
          submitLabel="Simpan perubahan"
          busy={update.isPending}
          errors={errors}
          formError={formError}
          showStatus
          onSubmit={(draft) => update.mutate(draft)}
          onCancel={() => router.push('/catalog')}
        />
      ) : (
        <FormSection title="Rincian">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="16px">
            <Detail label="Kategori" value={resource.category ?? '—'} />
            {/* Price, deposit and late fee are absent entirely for a role that
                may not change them (BR-003). */}
            {canSeePrices && (
              <Detail
                label="Harga"
                value={formatPrice(resource.base_price, resource.pricing_unit)}
              />
            )}
            <Detail label="Jeda bersih-bersih" value={`${resource.buffer_minutes} menit`} />
            <Detail
              label="Durasi"
              value={durationText(resource.min_duration, resource.max_duration)}
            />
            <Detail
              label="Verifikasi identitas"
              value={resource.requires_id_verification ? 'Wajib' : 'Tidak wajib'}
            />
            <Box>
              <Text fontSize="xs" color="text.secondary" mb="4px">
                Status
              </Text>
              <Badge colorScheme={resource.status === 'active' ? 'green' : 'gray'}>
                {resource.status === 'active' ? 'aktif' : 'nonaktif'}
              </Badge>
            </Box>
          </SimpleGrid>
        </FormSection>
      )}
    </PageShell>
  )
}

/**
 * Barang ini bisa dibooking atau belum, dan tombol yang memperbaikinya.
 *
 * Satu kartu, bukan dua: kartu kedua yang isinya cuma tombol adalah permukaan
 * kedua untuk satu pekerjaan. Dan BR-010 yang dijawab di sini -- barang tanpa
 * unit `active` tidak pernah muncul di pencarian ketersediaan, yang dari layar
 * ini kelihatan seperti barangnya hilang.
 */
function Kelengkapan({ id, unitCount }: { id: string; unitCount: number }) {
  const siap = unitCount > 0

  return (
    <Card variant="section" p="20px">
      <Text fontSize="sm" fontWeight="700" color="text.primary" mb="10px">
        Kelengkapan
      </Text>

      <Flex align="flex-start" gap="8px" mb="16px">
        {/* Bukan warna saja: ikon dan kalimatnya masing-masing sudah cukup
            membedakan siap dari belum. */}
        <Text as="span" aria-hidden="true" color={siap ? 'green.500' : 'orange.500'}>
          {siap ? '✓' : '!'}
        </Text>
        <Text fontSize="xs" color="text.secondary">
          {siap
            ? `${unitCount} unit aktif — barang ini bisa dibooking.`
            : 'Belum ada unit aktif. Selama kosong, barang ini tidak muncul di pencarian ketersediaan.'}
        </Text>
      </Flex>

      <Button as={Link} href={`/catalog/${id}/units`} variant="outline" w="100%">
        Kelola unit
      </Button>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="text.secondary" mb="4px">
        {label}
      </Text>
      <Text fontSize="sm" color="text.primary" fontWeight="500">
        {value}
      </Text>
    </Box>
  )
}

/** Empty bounds read as "no limit", never as zero (BR-016, BR-021). */
function durationText(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return 'Tanpa batas'
  if (min != null && max == null) return `Minimal ${min} hari`
  if (min == null && max != null) return `Maksimal ${max} hari`
  return `${min}–${max} hari`
}
