'use client'

import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  IconButton,
  Image,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { CheckCircleIcon, CloseIcon } from '@chakra-ui/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { MoneyField } from 'components/fields/MoneyField'
import { HandoverFields, StickyAction } from 'components/handover/HandoverFields'
import { PhotoPicker } from 'components/handover/PhotoPicker'
import { PageShell } from 'components/layout/PageShell'
import { useIdempotencyKey } from 'hooks/useIdempotencyKey'
import { usePhotoUpload } from 'hooks/usePhotoUpload'
import { api, problemCode } from 'lib/api/client'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

import { useHandoverContext } from '../useHandoverContext'

type Damage = { id: string; photoId: string; amount: number | null; description: string; checked: boolean }

/**
 * Terima kembali, dengan pratinjau denda dan jalur pembebasan.  (S1-037, S1-038)
 *
 * The fee is shown before anything is confirmed. The late fee and every damage
 * sit in one checklist; the deposit balance is recomputed on every tick, as a
 * preview -- settling it is a separate step (S1-042). Waiving any part of the
 * fee needs a reason, and the form refuses without one (BR-046, BR-051).
 */
export default function ReturnPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const ctx = useHandoverContext(id)
  const toast = useToast()
  const photos = usePhotoUpload('handover_photo')
  const [idemKey, renewKey] = useIdempotencyKey()

  const [meter, setMeter] = useState('')
  const [checklist, setChecklist] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [chargeFee, setChargeFee] = useState(true)
  const [waived, setWaived] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [damages, setDamages] = useState<Damage[]>([])
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)

  const preview = useQuery({
    // Not under ['bookings']: that prefix is invalidated on success, and a
    // preview of a booking that is no longer out is a 422, not a refresh.
    queryKey: ['return-preview', id],
    // The fee grows with the clock; a stale preview would show the wrong amount.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}/return-preview', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })

  const fee = preview.data?.late_fee_total ?? 0
  const waivedPart = chargeFee ? Math.min(waived ?? 0, fee) : fee
  const charged = fee - waivedPart
  const damageTotal = damages.filter((d) => d.checked).reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const deposit = preview.data?.deposit_amount ?? null
  const needsReason = fee > 0 && waivedPart > 0

  const simpan = useMutation({
    retry: false,
    mutationFn: async () => {
      const keyOf = (photoId: string) => photos.photos.find((p) => p.id === photoId)?.key ?? ''
      const { error } = await api.POST('/bookings/{id}/return', {
        params: { path: { id }, header: { 'Idempotency-Key': idemKey } },
        body: {
          photo_keys: photos.keys,
          ...(meter !== '' ? { meter_value: Number(meter) } : {}),
          ...(Object.keys(checklist).length > 0 ? { checklist } : {}),
          ...(notes.trim() !== '' ? { condition_notes: notes.trim() } : {}),
          ...(fee > 0 ? { confirm_late_fee: chargeFee } : {}),
          ...(chargeFee && waivedPart > 0 ? { late_fee_waived: waivedPart } : {}),
          ...(needsReason ? { waiver_reason: reason.trim() } : {}),
          damages: damages.filter((d) => d.checked).map((d) => ({
            amount: d.amount ?? 0, description: d.description.trim(), photo_key: keyOf(d.photoId),
          })),
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      // Ke daftar, bukan ke modal detail: pekerjaannya selesai, toast yang
      // mengabarkan. Detailnya tetap satu klik dari daftar.
      toast({ status: 'success', duration: 4000, title: `${ctx.booking?.code ?? 'Booking'}: unit diterima kembali` })
      router.push('/bookings')
    },
    onError: (problem) => {
      const code = problemCode(problem)
      if (code !== '' && code !== 'request-in-flight') renewKey()
      switch (code) {
        case 'waiver-reason-required':
          return setError({ field: 'reason', message: 'Tulis alasan pembebasan denda.' })
        case 'meter-value-required':
          return setError({ field: 'meter', message: 'Isi odometer — wajib untuk kendaraan.' })
        case 'handover-photo-required':
          return setError({ message: 'Ambil minimal satu foto kondisi unit.' })
        case 'upload-not-found':
        case 'upload-type-mismatch':
          return setError({ message: 'Salah satu foto tidak ditemukan di penyimpanan. Buang lalu ambil ulang foto itu.' })
        case 'request-in-flight':
          return setError({ message: 'Masih diproses. Tunggu sebentar — jangan tekan lagi.' })
        default:
          return setError({ message: 'Pengembalian gagal disimpan. Periksa kerusakan yang dicentang, lalu coba lagi.' })
      }
    },
  })

  if (ctx.isPending || !ctx.booking || preview.isPending) {
    return <PageShell title="Terima kembali" width="form-aside"><Flex py="60px" justify="center"><Spinner size="lg" /></Flex></PageShell>
  }
  const b = ctx.booking
  const p = preview.data
  const donePhotos = photos.photos.filter((x) => x.status === 'done')
  // Tombol nonaktif tidak pernah bisu: baris di atasnya menyebut syarat PERTAMA
  // yang belum terpenuhi. "Kenapa tombolnya mati" bukan teka-teki untuk
  // operator yang berdiri di samping penyewa.
  const kurang = (() => {
    if (photos.keys.length === 0) return 'Ambil minimal satu foto kondisi dulu.'
    if (photos.pending) return 'Tunggu semua foto selesai terunggah.'
    if (ctx.isVehicle && meter === '') return 'Isi odometer dulu.'
    const i = damages.findIndex((d) => d.checked && (d.photoId === '' || (d.amount ?? 0) <= 0 || d.description.trim() === ''))
    if (i >= 0) {
      const d = damages[i]
      if (d.photoId === '') return `Kerusakan ${i + 1}: ketuk satu foto sebagai bukti.`
      if ((d.amount ?? 0) <= 0) return `Kerusakan ${i + 1}: isi biayanya.`
      return `Kerusakan ${i + 1}: tulis keterangannya.`
    }
    if (needsReason && reason.trim() === '') return 'Tulis alasan pembebasan denda.'
    return null
  })()
  const bisa = kurang === null

  return (
    <PageShell title={`Kembali ${b.code}`} width="form-aside"
      breadcrumb={[{ label: 'Booking', href: '/bookings' }, { label: b.code, href: `/bookings?id=${id}` }]}>
      <Text fontSize="sm" color="text.secondary" mb="12px">
        <Text as="span" fontWeight="700" color="text.primary">{b.customer.name}</Text>
        {' · '}{b.resource.name} · {b.unit.label ? `${b.unit.label} (${b.unit.code})` : b.unit.code}
        {' · '}seharusnya kembali {formatDateTime(b.end_at)}
      </Text>

      {/* Dua kolom di lg: foto + kondisi kiri, tagihan kanan. HP tetap satu kolom. */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="16px" alignItems="start" mb="16px">
      <Card variant="section">
        <PhotoPicker photos={photos.photos} onAdd={photos.add} onRetry={photos.retry}
          onRemove={(pid) => { photos.remove(pid); setDamages((ds) => ds.map((d) => d.photoId === pid ? { ...d, photoId: '' } : d)) }} />
        <HandoverFields isVehicle={ctx.isVehicle} meter={meter} onMeter={setMeter}
          meterError={error?.field === 'meter' ? error.message : undefined}
          items={ctx.items} checklist={checklist} onChecklist={(k, v) => setChecklist((c) => ({ ...c, [k]: v }))}
          notes={notes} onNotes={setNotes} />
      </Card>

      <Card variant="section">
        <Text fontWeight="700" color="text.primary" mb="10px">Tagihan tambahan</Text>

        {p && p.overdue_units === 0 && <Text fontSize="sm" color="text.secondary">Tepat waktu — tidak ada denda telat.</Text>}
        {p && p.overdue_units > 0 && p.late_fee_per_unit === null && (
          // BR-016: no rate means no line, but the lateness itself is still real.
          <Text fontSize="sm" color="text.secondary">Telat {p.overdue_units} {p.pricing_unit === 'hour' ? 'jam' : 'hari'}. Barang ini tanpa tarif denda.</Text>
        )}
        {p && fee > 0 && (
          <Box>
            <Checkbox size="lg" isChecked={chargeFee} onChange={(e) => setChargeFee(e.target.checked)}>
              <Text fontSize="sm" color="text.primary">
                {p.proposed_lines[0]?.description} · {formatRupiah(fee)}
              </Text>
            </Checkbox>
            {chargeFee && (
              <Box mt="10px" ps="32px">
                <MoneyField label="Bebaskan sebagian" value={waived} onChange={setWaived} nullable
                  emptyMeans="Kosong = ditagih penuh." />
              </Box>
            )}
            {needsReason && (
              <FormControl isInvalid={error?.field === 'reason' || reason.trim() === ''} mt="8px">
                <FormLabel fontSize="sm" fontWeight="600" color="text.primary">Alasan pembebasan</FormLabel>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                  placeholder="Terlambat karena jalan ditutup banjir." />
                <FormErrorMessage>Wajib diisi — denda yang dibebaskan harus bisa dijelaskan.</FormErrorMessage>
              </FormControl>
            )}
          </Box>
        )}

        {/* BR-047: each damage points at one of THIS return's photos. */}
        {damages.map((d, i) => (
          <Box key={d.id} mt="16px" pt="12px" borderTopWidth="1px" borderColor="border.subtle">
            <Flex justify="space-between" align="center">
              <Checkbox size="lg" isChecked={d.checked}
                onChange={(e) => setDamages((ds) => ds.map((x) => x.id === d.id ? { ...x, checked: e.target.checked } : x))}>
                <Text fontSize="sm" color="text.primary">Kerusakan {i + 1}</Text>
              </Checkbox>
              <IconButton aria-label="Hapus kerusakan ini" icon={<CloseIcon boxSize="8px" />} size="sm" variant="ghost"
                onClick={() => setDamages((ds) => ds.filter((x) => x.id !== d.id))} />
            </Flex>
            <Text fontSize="xs" color={d.checked && d.photoId === '' && donePhotos.length > 0 ? 'red.500' : 'text.secondary'}
              mt="8px" mb="4px">
              Foto bukti — ketuk salah satu
            </Text>
            <SimpleGrid columns={4} gap="6px">
              {donePhotos.map((ph) => (
                <Box key={ph.id} as="button" type="button" position="relative" borderRadius="8px" overflow="hidden"
                  borderWidth="2px" borderColor={d.photoId === ph.id ? 'brand.500' : 'border.subtle'}
                  _focusVisible={{ boxShadow: 'outline' }}
                  aria-pressed={d.photoId === ph.id} aria-label="Pilih foto ini sebagai bukti"
                  onClick={() => setDamages((ds) => ds.map((x) => x.id === d.id ? { ...x, photoId: ph.id } : x))}>
                  <Image src={ph.preview} alt="" objectFit="cover" w="100%" h="56px" />
                  {d.photoId === ph.id && (
                    <CheckCircleIcon position="absolute" top="4px" right="4px" boxSize="16px"
                      color="brand.500" bg="white" borderRadius="full" />
                  )}
                </Box>
              ))}
            </SimpleGrid>
            {donePhotos.length === 0 && <Text fontSize="xs" color="red.500">Ambil foto kerusakannya dulu di atas.</Text>}
            <Box mt="10px">
              <MoneyField label="Biaya" value={d.amount} nullable={false}
                onChange={(v) => setDamages((ds) => ds.map((x) => x.id === d.id ? { ...x, amount: v } : x))} />
            </Box>
            <Input mt="8px" value={d.description} placeholder="Baret pintu kiri" maxLength={300}
              onChange={(e) => setDamages((ds) => ds.map((x) => x.id === d.id ? { ...x, description: e.target.value } : x))} />
          </Box>
        ))}
        <Button mt="14px" variant="outline" size="sm"
          onClick={() => setDamages((ds) => [...ds, { id: crypto.randomUUID(), photoId: '', amount: null, description: '', checked: true }])}>
          + Catat kerusakan
        </Button>

        <Box mt="16px" pt="12px" borderTopWidth="1px" borderColor="border.subtle">
          <Flex justify="space-between" fontSize="sm"><Text color="text.secondary">Ditagihkan</Text>
            <Text fontWeight="700" color="text.primary">{formatRupiah(charged + damageTotal)}</Text></Flex>
          {deposit !== null && (
            // A preview only: settling the deposit is its own step (S1-042).
            <Flex justify="space-between" fontSize="sm" mt="4px">
              <Text color="text.secondary">Sisa deposit {formatRupiah(deposit)} kalau dipotong</Text>
              <Text fontWeight="700" color={deposit - charged - damageTotal < 0 ? 'red.500' : 'text.primary'}>
                {formatRupiah(deposit - charged - damageTotal)}
              </Text>
            </Flex>
          )}
        </Box>
      </Card>
      </SimpleGrid>

      {error !== null && error.field === undefined && (
        <Card variant="panel" role="alert" mb="16px"><Text fontSize="sm" color="text.primary">{error.message}</Text></Card>
      )}

      <StickyAction>
        <Box flex="1">
          {kurang !== null && (
            <Text fontSize="sm" color="text.secondary" textAlign="center" mb="6px" aria-live="polite">{kurang}</Text>
          )}
          <Button w="100%" h="56px" variant="brand" fontSize="md" isDisabled={!bisa}
            isLoading={simpan.isPending} onClick={() => { setError(null); simpan.mutate() }}>
            {photos.pending ? 'Menunggu foto terunggah…' : 'Terima unit kembali'}
          </Button>
        </Box>
      </StickyAction>
    </PageShell>
  )
}
