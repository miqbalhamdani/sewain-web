'use client'

import { Badge, Box, Button, Flex, Heading, Image, Input, Link, Text } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PhotoLightbox, type LightboxPhoto } from 'components/handover/PhotoLightbox'
import { useCan } from 'contexts/SessionContext'
import { useDialogState } from 'hooks/useDialogState'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type Invoice = components['schemas']['Invoice']
type Proof = components['schemas']['PaymentProof']

// Badge-nya satu-dua kata; kalimatnya ada di `penjelasan` di bawah. Badge
// yang memuat kalimat panjang berhuruf kapital tidak terbaca sebagai status.
const BACAAN: Record<string, { label: string; scheme: string }> = {
  match: { label: 'cocok', scheme: 'green' },
  mismatch: { label: 'tidak cocok', scheme: 'orange' },
  unreadable: { label: 'tak terbaca', scheme: 'gray' },
}
const BELUM_DIBACA = { label: 'periksa manual', scheme: 'gray' }

/**
 * Kalimat di bawah badge: apa yang harus DILAKUKAN orangnya, bukan apa kata
 * mesin. Pembacaan otomatis adalah rekomendasi (BR-062); yang menyetujui
 * tetap manusia, jadi kalimatnya selalu berakhir pada "cocokkan sendiri".
 */
function penjelasan(p: Proof, total: number): string {
  const terbaca = p.ai_amount === null ? null : formatRupiah(p.ai_amount)
  switch (p.match_status) {
    case 'match':
      return `Terbaca ${terbaca}, sama dengan tagihan. Tetap cocokkan sendiri — ini rekomendasi, bukan keputusan.`
    case 'mismatch':
      return `Terbaca ${terbaca}, tidak sama dengan tagihan ${formatRupiah(total)}. Periksa sebelum memutuskan.`
    case 'unreadable':
      return 'Nominal tidak terbaca otomatis. Periksa gambarnya sendiri.'
    default:
      return `Belum ada pembacaan otomatis. Cocokkan nominal dan tanggal di gambar dengan tagihan ${formatRupiah(total)} sebelum menyetujui.`
  }
}

/**
 * Transfer proofs of one invoice.  (S1-049, BR-062)
 *
 * The automatic reading is shown as a RECOMMENDATION, never as a status --
 * and in phase 1 there is no reader, so every proof says "check by hand". Only
 * a person pressing Setujui makes the invoice paid.
 *
 * Bagian ini hanya MENINJAU. Bukti yang menunggu datang dari penyewa lewat
 * portal; bukti yang dilampirkan operator saat mencatat pembayaran
 * (RecordPaymentDialog) sudah disetujui saat tiba di sini. Tidak ada tombol
 * unggah di sini lagi -- tiga pintu untuk "uangnya sudah masuk" membuat
 * operator baru tidak tahu harus mulai dari mana.
 *
 * Gambarnya tampil langsung sebagai thumbnail: pekerjaan di sini adalah
 * mencocokkan nominal di struk dengan tagihan, dan tombol Setujui di samping
 * gambar yang belum terlihat adalah undangan menyetujui tanpa melihat.
 */
export function ProofSection({ invoice, primary = false }: {
  invoice: Invoice
  /** Setujui tampil ungu hanya kalau kartu langkah menunjuk ke sini (satu tombol ungu per halaman). */
  primary?: boolean
}) {
  const queryClient = useQueryClient()
  const canPay = useCan('payments:write')
  const lb = useDialogState<{ photos: LightboxPhoto[]; index: number }>()
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const { data: proofs } = useQuery({
    queryKey: ['invoices', invoice.id, 'proofs'],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices/{id}/proofs', { params: { path: { id: invoice.id } } })
      if (error) throw error
      return data
    },
  })

  const putus = useMutation({
    retry: false,
    mutationFn: async ({ proof, approve }: { proof: Proof; approve: boolean }) => {
      const { error } = approve
        ? await api.POST('/proofs/{id}/approve', {
          params: { path: { id: proof.id }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
        : await api.POST('/proofs/{id}/reject', { params: { path: { id: proof.id } }, body: { reason: reason.trim() } })
      if (error) throw error
    },
    onSuccess: () => {
      setRejecting(null)
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: (p) => setError(problemCode(p) === 'invoice-already-paid' ? 'Invoice ini sudah lunas.' : 'Keputusan gagal disimpan.'),
  })

  if ((proofs?.length ?? 0) === 0) return null

  const open = invoice.status === 'unpaid' || invoice.status === 'overdue'
  // Satu lightbox untuk semua bukti bergambar milik invoice ini, supaya ‹ ›
  // berpindah antar bukti. PDF tidak ikut: ia dibuka di tab baru.
  const bergambar = (proofs ?? []).filter((p) => p.content_type !== 'application/pdf')
  const fotoLightbox: LightboxPhoto[] = bergambar.map((p) => ({
    url: p.url, href: p.url, caption: `Bukti transfer · ${formatDateTime(p.created_at)}`,
  }))

  return (
    <Box id={`bukti-${invoice.id}`} mt="12px" pt="10px" borderTopWidth="1px" borderColor="border.subtle">
      {/* h3 yang bisa difokus: langkah "Periksa bukti transfer" menggulir ke sini. */}
      <Heading as="h3" size="xs" tabIndex={-1} mb="6px" borderRadius="4px" _focusVisible={{ boxShadow: 'outline' }}>
        Bukti transfer
      </Heading>

      {proofs?.map((p) => {
        const pdf = p.content_type === 'application/pdf'
        const kapan = formatDateTime(p.created_at)
        const pending = p.review_status === 'pending'
        const badge = !pending
          ? { label: p.review_status === 'approved' ? 'disetujui' : 'ditolak', scheme: p.review_status === 'approved' ? 'green' : 'red' }
          : p.match_status
            ? BACAAN[p.match_status] ?? { label: p.match_status, scheme: 'gray' }
            : BELUM_DIBACA
        return (
          <Box key={p.id} py="8px">
            <Flex gap="12px" align="flex-start">
              {pdf ? (
                <Flex direction="column" align="center" justify="center" gap="2px" w="96px" h="96px" flexShrink={0}
                  borderRadius="12px" borderWidth="1px" borderColor="border.subtle" bg="surface.sunken">
                  <Text fontWeight="700" color="text.primary">PDF</Text>
                  <Link href={p.url} isExternal color="brand.500" fontSize="sm" fontWeight="600">Buka</Link>
                </Flex>
              ) : (
                <Box as="button" type="button" w="96px" h="96px" flexShrink={0} borderRadius="12px" overflow="hidden"
                  borderWidth="1px" borderColor="border.subtle" _focusVisible={{ boxShadow: 'outline' }}
                  aria-label={`Perbesar bukti transfer ${kapan}`}
                  onClick={() => lb.open({ photos: fotoLightbox, index: bergambar.indexOf(p) })}>
                  <Image src={p.url} alt="" objectFit="cover" w="100%" h="100%" />
                </Box>
              )}

              {/* Semua rata kiri, menempel pada gambarnya. Didorong ke ujung
                  kanan kartu, badge ini pernah luput dari mata pemiliknya. */}
              <Box flex="1" minW="0">
                <Text fontSize="sm" color="text.secondary">{kapan}</Text>
                <Badge mt="4px" colorScheme={badge.scheme}>{badge.label}</Badge>
                {pending && open && (
                  <Text fontSize="sm" color="text.secondary" mt="6px">{penjelasan(p, invoice.total)}</Text>
                )}
                {pending && !open && (
                  <Text fontSize="sm" color="text.secondary" mt="6px">
                    Tagihan ini sudah lunas lewat pencatatan lain, jadi bukti ini tidak perlu ditinjau lagi.
                  </Text>
                )}
                {p.review_status === 'rejected' && (
                  <Text fontSize="sm" color="text.secondary" mt="6px">Alasan: {p.reject_reason}</Text>
                )}
              </Box>
            </Flex>

            {canPay && open && pending && rejecting !== p.id && (
              <Flex gap="8px" mt="10px" wrap="wrap">
                {/* Labelnya menyebut akibatnya: menyetujui bukti = invoice lunas (BR-062). */}
                <Button size="sm" variant={primary ? 'brand' : 'outline'} isLoading={putus.isPending}
                  onClick={() => { setError(''); putus.mutate({ proof: p, approve: true }) }}>Setujui — tandai lunas</Button>
                <Button size="sm" variant="outline" onClick={() => { setError(''); setRejecting(p.id) }}>Tolak bukti</Button>
              </Flex>
            )}
            {rejecting === p.id && (
              <Flex gap="8px" mt="10px">
                <Input size="sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan, mis. nominal kurang" />
                <Button size="sm" variant="outline" colorScheme="red" isDisabled={reason.trim() === ''}
                  isLoading={putus.isPending} onClick={() => putus.mutate({ proof: p, approve: false })}>Tolak</Button>
              </Flex>
            )}
          </Box>
        )
      })}

      {error !== '' && <Text role="alert" fontSize="sm" color="red.500">{error}</Text>}

      {lb.value && (
        <PhotoLightbox photos={lb.value.photos} initialIndex={lb.value.index}
          isOpen={lb.isOpen} onClose={lb.close} onCloseComplete={lb.onCloseComplete} />
      )}
    </Box>
  )
}
