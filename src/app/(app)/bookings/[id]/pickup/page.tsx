'use client'

import { Box, Button, Card, Flex, Spinner, Text } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { HandoverFields, StickyAction } from 'components/handover/HandoverFields'
import { PhotoPicker } from 'components/handover/PhotoPicker'
import { PageShell } from 'components/layout/PageShell'
import { ConfirmDialog } from 'components/table/ConfirmDialog'
import { useIdempotencyKey } from 'hooks/useIdempotencyKey'
import { usePhotoUpload } from 'hooks/usePhotoUpload'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatRange } from 'lib/format/datetime'

import { useHandoverContext } from '../useHandoverContext'

type Conflict = components['schemas']['AffectedBooking']

/**
 * Serah-terima ambil, mobile-first.  (S1-037)
 *
 * One column, big targets, the action pinned to the bottom: done standing in a
 * parking lot with a phone in one hand, under three minutes (PRD §10).
 */
export default function PickupPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const ctx = useHandoverContext(id)
  const photos = usePhotoUpload('handover_photo')
  const [idemKey, renewKey] = useIdempotencyKey()

  const [meter, setMeter] = useState('')
  const [checklist, setChecklist] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [physical, setPhysical] = useState<Conflict[] | null>(null)

  const simpan = useMutation({
    retry: false,
    mutationFn: async (confirmPhysical: boolean) => {
      const { error } = await api.POST('/bookings/{id}/pickup', {
        params: { path: { id }, header: { 'Idempotency-Key': idemKey } },
        body: {
          photo_keys: photos.keys,
          ...(meter !== '' ? { meter_value: Number(meter) } : {}),
          ...(Object.keys(checklist).length > 0 ? { checklist } : {}),
          ...(notes.trim() !== '' ? { condition_notes: notes.trim() } : {}),
          ...(confirmPhysical ? { confirm_physical_conflict: true } : {}),
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.push(`/bookings?id=${id}`)
    },
    onError: (problem) => {
      const code = problemCode(problem)
      if (code !== '' && code !== 'request-in-flight') renewKey()
      setPhysical(null)
      switch (code) {
        case 'physical-conflict-unconfirmed':
          // BR-042: an explicit dialog, never a toast that scrolls away.
          return setPhysical((problem as { conflicts?: Conflict[] }).conflicts ?? [])
        case 'meter-value-required':
          return setError({ field: 'meter', message: 'Isi odometer — wajib untuk kendaraan.' })
        case 'handover-photo-required':
          return setError({ message: 'Ambil minimal satu foto kondisi unit.' })
        case 'upload-not-found':
        case 'upload-type-mismatch':
          return setError({ message: 'Salah satu foto tidak ditemukan di penyimpanan. Buang lalu ambil ulang foto itu.' })
        case 'payment-required-before-pickup':
          return setError({ message: 'Usaha ini mewajibkan sewa lunas sebelum unit diambil. Catat pembayarannya dulu.' })
        case 'request-in-flight':
          return setError({ message: 'Masih diproses. Tunggu sebentar — jangan tekan lagi.' })
        default:
          return setError({ message: 'Serah-terima gagal disimpan. Coba lagi.' })
      }
    },
  })

  if (ctx.isPending || !ctx.booking) {
    return <PageShell title="Serah-terima ambil"><Flex py="60px" justify="center"><Spinner size="lg" /></Flex></PageShell>
  }
  const b = ctx.booking
  const bisa = photos.keys.length > 0 && !photos.pending && (!ctx.isVehicle || meter !== '')

  return (
    <PageShell title={`Ambil ${b.code}`} width="form"
      breadcrumb={[{ label: 'Booking', href: '/bookings' }, { label: b.code, href: `/bookings?id=${id}` }]}>
      <Card variant="section" mb="16px">
        <Text fontWeight="700" color="text.primary">{b.customer.name}</Text>
        <Text fontSize="sm" color="text.secondary">
          {b.resource.name} · {b.unit.label ? `${b.unit.label} (${b.unit.code})` : b.unit.code}
        </Text>
        <Text fontSize="sm" color="text.secondary">{formatRange(b.start_at, b.end_at)}</Text>
      </Card>

      <Card variant="section">
        <PhotoPicker photos={photos.photos} onAdd={photos.add} onRetry={photos.retry} onRemove={photos.remove} />
        <HandoverFields isVehicle={ctx.isVehicle} meter={meter} onMeter={setMeter}
          meterError={error?.field === 'meter' ? error.message : undefined}
          items={ctx.items} checklist={checklist} onChecklist={(k, v) => setChecklist((c) => ({ ...c, [k]: v }))}
          notes={notes} onNotes={setNotes} />
      </Card>

      {error !== null && error.field === undefined && (
        <Card variant="panel" role="alert" mt="16px"><Text fontSize="sm" color="text.primary">{error.message}</Text></Card>
      )}

      <StickyAction>
        <Box flex="1">
          <Button w="100%" h="56px" variant="brand" fontSize="md" isDisabled={!bisa}
            isLoading={simpan.isPending} onClick={() => { setError(null); simpan.mutate(false) }}>
            {photos.pending ? 'Menunggu foto terunggah…' : 'Serahkan unit'}
          </Button>
        </Box>
      </StickyAction>

      <ConfirmDialog
        isOpen={physical !== null}
        title="Unitnya benar-benar ada di depanmu?"
        body={`Menurut sistem, unit ini masih dibawa ${physical?.map((c) => `${c.code} (${formatRange(c.start_at, c.end_at)})`).join(', ') ?? ''} dan belum dikembalikan. Pilih Ya hanya kalau unitnya ada di sini.`}
        busy={simpan.isPending}
        onCancel={() => setPhysical(null)}
        onConfirm={() => simpan.mutate(true)}
      />
    </PageShell>
  )
}
