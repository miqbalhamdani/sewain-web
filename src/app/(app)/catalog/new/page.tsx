'use client'

import { Box, Heading, Text, useColorModeValue } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api, fieldErrors, problemCode } from 'lib/api/client'

import { ResourceForm, draftOf, localiseErrors, type ResourceDraft } from '../ResourceForm'

/** Add a kind of thing.  (S1-018) */
export default function NewResourcePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const textColorSecondary = 'gray.400'

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const create = useMutation({
    // Never retried: a POST that may have landed is not something to send
    // again on the client's own initiative (CLAUDE.md).
    retry: false,
    mutationFn: async (draft: ResourceDraft) => {
      const { data, error } = await api.POST('/resources', {
        body: {
          name: draft.name,
          // An empty category is absent, not an empty string -- there is no
          // difference to a reader and one of the two is a value nobody meant.
          ...(draft.category === '' ? {} : { category: draft.category }),
          base_price: draft.base_price ?? 0,
          // Null rather than omitted, and deliberately so: for these four,
          // null is a meaningful value meaning "this rule does not apply"
          // (BR-016). The general "drop empty optional fields" rule in
          // CLAUDE.md guards server-managed fields, not these.
          deposit_amount: draft.deposit_amount,
          late_fee_per_unit: draft.late_fee_per_unit,
          min_duration: draft.min_duration,
          max_duration: draft.max_duration,
          buffer_minutes: draft.buffer_minutes ?? 0,
          requires_id_verification: draft.requires_id_verification,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: (resource) => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
      // Straight to its units: a resource with none can never appear in
      // availability search, so "saved" is not yet "usable" (BR-010).
      router.replace(`/catalog/${resource.id}/units`)
    },
    onError: (problem) => {
      setErrors({})
      setFormError('')
      const fields = fieldErrors(problem)
      if (Object.keys(fields).length > 0) {
        setErrors(localiseErrors(fields))
        return
      }
      setFormError(
        problemCode(problem) === 'permission-denied'
          ? 'Akun kamu tidak bisa menambah barang.'
          : 'Barang gagal disimpan. Periksa isian kamu lalu coba lagi.',
      )
    },
  })

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }} maxW="880px">
      <Heading color={textColor} fontSize="28px" mb="4px">
        Tambah barang
      </Heading>
      <Text color={textColorSecondary} fontSize="sm" mb="24px">
        Jenis barangnya dulu. Unit fisiknya — plat atau nomor seri — ditambahkan setelah ini.
      </Text>

      <ResourceForm
        initial={draftOf()}
        submitLabel="Simpan barang"
        busy={create.isPending}
        errors={errors}
        formError={formError}
        onSubmit={(draft) => create.mutate(draft)}
        onCancel={() => router.push('/catalog')}
      />
    </Box>
  )
}
