'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api, fieldErrors, problemCode } from 'lib/api/client'

import { PageShell } from 'components/layout/PageShell'
import { useSession } from 'contexts/SessionContext'

import { ResourceForm, draftOf, localiseErrors, type ResourceDraft } from '../ResourceForm'

/** Teks kosong berarti tidak ada, dan `null` yang mengatakannya (BR-095). */
function orNull(v: string): string | null {
  return v.trim() === '' ? null : v
}

/** Add a kind of thing.  (S1-018) */
export default function NewResourcePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  // Preset pemiliknya yang memutuskan apakah form ini punya kartu Kendaraan
  // sama sekali (BR-094).
  const { owner } = useSession()
  const isVehicleRental = owner?.business_type === 'vehicle_rental'

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

          // Teks kosong dikirim sebagai null, bukan "". Keduanya berarti hal
          // yang sama bagi pembaca, dan halaman publik memeriksa satu saja
          // untuk memutuskan menampilkan bagian itu atau tidak (BR-095).
          description: orNull(draft.description),
          terms_excludes: orNull(draft.terms_excludes),
          terms_requirements: orNull(draft.terms_requirements),
          terms_cancellation: orNull(draft.terms_cancellation),

          // Hadir persis ketika presetnya `vehicle_rental`; server menolak
          // kedua arah yang salah (BR-094).
          ...(draft.vehicle ? { vehicle: draft.vehicle } : {}),
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
    <PageShell
      breadcrumb={[{ label: 'Barang', href: '/catalog' }]}
      width="form-aside"
      title="Tambah barang"
      subtitle="Jenis barangnya dulu. Unit fisiknya — plat atau nomor seri — ditambahkan setelah ini."
    >
      <ResourceForm
        initial={draftOf(undefined, isVehicleRental)}
        submitLabel="Simpan barang"
        busy={create.isPending}
        errors={errors}
        formError={formError}
        onSubmit={(draft) => create.mutate(draft)}
        onCancel={() => router.push('/catalog')}
      />
    </PageShell>
  )
}
