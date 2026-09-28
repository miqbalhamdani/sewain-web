'use client'

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCan } from 'contexts/SessionContext'
import { api, fieldErrors, problemCode } from 'lib/api/client'
import { formatPrice } from 'lib/format/money'

import { ResourceForm, draftOf, localiseErrors, type ResourceDraft } from '../ResourceForm'

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

  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const textColorSecondary = 'gray.400'

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
          category: draft.category === '' ? null : draft.category,
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
      <Flex pt="160px" justify="center">
        <Spinner size="lg" color="brand.500" thickness="3px" />
      </Flex>
    )
  }

  if (!resource) {
    return (
      <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
        <Card p="24px">
          <Text color={textColor}>Barang ini tidak ada di usaha kamu.</Text>
          <Button as={Link} href="/catalog" variant="brand" mt="16px" w="fit-content">
            Kembali ke daftar barang
          </Button>
        </Card>
      </Box>
    )
  }

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }} maxW="880px">
      <Flex align="center" justify="space-between" mb="24px" gap="16px" wrap="wrap">
        <Box>
          <Heading color={textColor} fontSize="28px" mb="4px">
            {resource.name}
          </Heading>
          <Text color={textColorSecondary} fontSize="sm">
            {resource.unit_count === 0
              ? 'Belum ada unit aktif — barang ini belum bisa dibooking.'
              : `${resource.unit_count} unit aktif`}
          </Text>
        </Box>
        <Button as={Link} href={`/catalog/${id}/units`} variant="outline" h="46px">
          Kelola unit
        </Button>
      </Flex>

      {saved !== '' && (
        <Card p="16px" mb="20px">
          <Text color={textColor} fontSize="sm">
            {saved}
          </Text>
        </Card>
      )}

      {canWrite ? (
        <ResourceForm
          initial={draftOf(resource)}
          submitLabel="Simpan perubahan"
          busy={update.isPending}
          errors={errors}
          formError={formError}
          showStatus
          onSubmit={(draft) => update.mutate(draft)}
          onCancel={() => router.push('/catalog')}
        />
      ) : (
        <Card p="24px">
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
              <Text fontSize="xs" color={textColorSecondary} mb="4px">
                Status
              </Text>
              <Badge colorScheme={resource.status === 'active' ? 'green' : 'gray'}>
                {resource.status === 'active' ? 'aktif' : 'nonaktif'}
              </Badge>
            </Box>
          </SimpleGrid>
        </Card>
      )}
    </Box>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  return (
    <Box>
      <Text fontSize="xs" color="gray.400" mb="4px">
        {label}
      </Text>
      <Text fontSize="sm" color={textColor} fontWeight="500">
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
