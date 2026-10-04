'use client'

import { CloseIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  useBreakpointValue,
  useToast,
} from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { MdAccountBalance, MdPayments } from 'react-icons/md'

import { useIdempotencyKey } from 'hooks/useIdempotencyKey'
import { usePhotoUpload } from 'hooks/usePhotoUpload'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatRupiah } from 'lib/format/money'

type Invoice = components['schemas']['Invoice']
type Method = 'cash' | 'manual_transfer'

const GAGAL: Record<string, string> = {
  'invoice-already-paid': 'Invoice ini sudah lunas — mungkin baru dicatat orang lain.',
  'request-in-flight': 'Masih diproses. Tunggu sebentar — jangan tekan lagi.',
  'upload-not-found': 'Berkas bukti tidak ditemukan di penyimpanan. Buang lalu pilih ulang.',
  'upload-type-mismatch': 'Berkas bukti tidak ditemukan di penyimpanan. Buang lalu pilih ulang.',
}

/**
 * Satu pintu untuk mencatat pembayaran.  (S1-049, BR-060, BR-062, BR-090)
 *
 * Dulu ada tiga: "Catat bayar tunai", "Catat bayar transfer", dan "Unggah
 * bukti" -- tiga tombol untuk satu niat ("uangnya sudah masuk"), dan operator
 * baru tidak tahu harus mulai dari mana. Sekarang: pilih caranya, opsional
 * simpan bukti dari penyewa, satu tombol yang menyebut nominalnya.
 *
 * Bukti yang dilampirkan di sini diserahkan lalu LANGSUNG disetujui atas nama
 * operator -- ia sudah mengecek uangnya, dialog ini hanya menyimpan buktinya.
 * Alur Setujui/Tolak di ProofSection tinggal untuk bukti yang diunggah
 * penyewa lewat portal.
 *
 * Satu Idempotency-Key per niat: dibuat saat dialog terbuka, dipakai ulang
 * di tiap percobaan ulang, diganti hanya sesudah jawaban 4xx yang pasti
 * (BR-090). Bukti yang sudah tersimpan diingat supaya percobaan ulang tidak
 * menyerahkannya dua kali.
 */
export function RecordPaymentDialog({ invoice, isOpen, onClose, onCloseComplete }: {
  invoice: Invoice
  isOpen: boolean
  onClose: () => void
  onCloseComplete?: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const full = (useBreakpointValue({ base: true, md: false }) ?? false) as boolean
  const input = useRef<HTMLInputElement>(null)
  const upload = usePhotoUpload('payment_proof')
  const [method, setMethod] = useState<Method | null>(null)
  const [error, setError] = useState('')
  const [idemKey, renewKey] = useIdempotencyKey()
  const proofId = useRef<string | null>(null)

  const bukti = upload.photos[0]
  const buktiPdf = bukti?.file.type === 'application/pdf'

  const catat = useMutation({
    retry: false,
    mutationFn: async (m: Method) => {
      const header = { 'Idempotency-Key': idemKey }
      if (m === 'manual_transfer' && upload.keys[0]) {
        if (!proofId.current) {
          const { data, error } = await api.POST('/invoices/{id}/proofs', {
            params: { path: { id: invoice.id } }, body: { object_key: upload.keys[0] },
          })
          if (error) throw error
          proofId.current = data.id
        }
        // Approve = pembayaran manual_transfer sebesar total + invoice paid +
        // bukti approved, satu transaksi di server (04-api-spec 3.8).
        const { error } = await api.POST('/proofs/{id}/approve', { params: { path: { id: proofId.current }, header } })
        if (error) throw error
        return
      }
      const { error } = await api.POST('/invoices/{id}/payments', {
        params: { path: { id: invoice.id }, header }, body: { method: m, amount: invoice.total },
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({ status: 'success', duration: 4000, title: `${invoice.number} lunas — ${formatRupiah(invoice.total)}` })
      onClose()
    },
    onError: (problem) => {
      const code = problemCode(problem)
      if (code !== '' && code !== 'request-in-flight') renewKey()
      setError(GAGAL[code] ?? 'Pembayaran gagal dicatat. Coba lagi.')
    },
  })

  const siap = method !== null && !upload.pending && !bukti?.status.startsWith('error')

  return (
    <Modal isOpen={isOpen} onClose={onClose} onCloseComplete={onCloseComplete}
      size={full ? 'full' : 'md'} isCentered={!full} closeOnOverlayClick={!catat.isPending}>
      <ModalOverlay />
      <ModalContent borderRadius={full ? '0' : '20px'}>
        <ModalHeader pe="56px">
          <Text fontSize="lg" fontWeight="700" color="text.primary">Catat pembayaran {invoice.number}</Text>
        </ModalHeader>
        <ModalCloseButton top="16px" right="16px" />

        <ModalBody>
          <Text fontSize="sm" color="text.secondary">Jumlah yang dibayar</Text>
          <Text fontSize="2xl" fontWeight="700" color="text.primary" lineHeight="1.2">{formatRupiah(invoice.total)}</Text>
          {/* BR-060: tidak ada pembayaran sebagian, jadi nominalnya tidak ditanyakan. */}
          <Text fontSize="sm" color="text.secondary" mt="4px" mb="20px">Lunas penuh — tidak ada pembayaran sebagian.</Text>

          <Text fontWeight="600" color="text.primary" mb="8px" id="cara-bayar">Dibayar lewat</Text>
          <Flex role="group" aria-labelledby="cara-bayar" gap="12px" direction={{ base: 'column', md: 'row' }}>
            {([
              { m: 'cash' as const, label: 'Tunai', hint: 'Uang diterima langsung', icon: MdPayments },
              { m: 'manual_transfer' as const, label: 'Transfer bank', hint: 'Sudah masuk ke rekening', icon: MdAccountBalance },
            ]).map(({ m, label, hint, icon: Ikon }) => {
              const aktif = method === m
              return (
                // minW 0 + whiteSpace normal: Button bawaannya nowrap dan menolak
                // menyusut, jadi keterangan dua kata keluar dari kotaknya.
                <Button key={m} type="button" variant="outline" flex="1" minW="0" h="auto" py="14px" px="16px"
                  aria-pressed={aktif} justifyContent="flex-start" textAlign="left" whiteSpace="normal"
                  borderWidth="2px" borderColor={aktif ? 'brand.500' : 'border.subtle'}
                  bg={aktif ? 'surface.sunken' : 'transparent'}
                  leftIcon={<Ikon size="24px" />} iconSpacing="12px" onClick={() => { setError(''); setMethod(m) }}>
                  <Box minW="0">
                    <Text fontWeight="700" color="text.primary">{label}</Text>
                    <Text fontSize="sm" fontWeight="400" color="text.secondary">{hint}</Text>
                  </Box>
                </Button>
              )
            })}
          </Flex>

          {method === 'manual_transfer' && (
            <Box mt="20px">
              <Text fontWeight="600" color="text.primary" mb="4px">Bukti dari penyewa <Text as="span" fontWeight="400" color="text.secondary">(opsional)</Text></Text>
              <Text fontSize="sm" color="text.secondary" mb="8px">
                Kalau penyewa mengirim struk lewat WhatsApp, simpan di sini supaya ikut tercatat di tagihan.
              </Text>
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden
                onChange={(e) => {
                  setError('')
                  if (e.target.files && upload.add(e.target.files).length > 0) setError('Berkas dilewati — hanya JPG, PNG, WebP, atau PDF, maksimal 10 MB.')
                  e.target.value = ''
                }} />
              {!bukti ? (
                <Button w="100%" h="48px" variant="outline" onClick={() => input.current?.click()}>Pilih berkas bukti</Button>
              ) : (
                <Flex align="center" gap="12px" borderWidth="1px" borderColor="border.subtle" borderRadius="12px" p="10px">
                  {buktiPdf ? (
                    <Flex w="64px" h="64px" align="center" justify="center" borderRadius="10px" bg="surface.sunken" flexShrink={0}>
                      <Text fontWeight="700" color="text.primary">PDF</Text>
                    </Flex>
                  ) : (
                    <Image src={bukti.preview} alt="" objectFit="cover" w="64px" h="64px" borderRadius="10px" flexShrink={0} />
                  )}
                  <Box flex="1" minW="0">
                    <Text fontSize="sm" color="text.primary" noOfLines={1}>{bukti.file.name}</Text>
                    {bukti.status === 'uploading' && <Progress value={bukti.progress * 100} size="xs" mt="6px" aria-label="Progres unggah" />}
                    {bukti.status === 'done' && <Text fontSize="sm" color="text.secondary">Terunggah</Text>}
                    {bukti.status === 'error' && (
                      <Button size="sm" variant="link" colorScheme="red" onClick={() => upload.retry(bukti.id)}>Gagal terunggah — coba lagi</Button>
                    )}
                  </Box>
                  <IconButton aria-label="Buang berkas bukti" icon={<CloseIcon boxSize="10px" />} size="sm" variant="ghost"
                    onClick={() => { upload.remove(bukti.id); proofId.current = null }} />
                </Flex>
              )}
            </Box>
          )}

          {error !== '' && <Text role="alert" fontSize="sm" color="red.500" mt="12px">{error}</Text>}
        </ModalBody>

        <ModalFooter gap="12px" flexWrap="wrap" borderTopWidth="1px" borderColor="border.subtle"
          pb={full ? 'calc(16px + env(safe-area-inset-bottom))' : undefined}>
          {/* Tombol nonaktif tidak bisu: baris di atas tombol yang menyebut
              syaratnya. Satu baris penuh DULU, baru baris tombolnya -- disisipkan
              di antara dua tombol, ia memecah footer jadi tiga baris. */}
          {method === null && <Text fontSize="sm" color="text.secondary" w="100%" textAlign="right">Pilih cara bayar dulu.</Text>}
          {method !== null && upload.pending && <Text fontSize="sm" color="text.secondary" w="100%" textAlign="right">Tunggu berkas selesai terunggah.</Text>}
          <Button variant="outline" h="48px" onClick={onClose} isDisabled={catat.isPending}>Batal</Button>
          <Box flex="1" />
          <Button variant="brand" h="48px" px="24px" isDisabled={!siap} isLoading={catat.isPending}
            onClick={() => { setError(''); if (method) catat.mutate(method) }}>
            Catat lunas {formatRupiah(invoice.total)}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
