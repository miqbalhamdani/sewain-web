'use client'

import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Flex,
  Grid,
  Heading,
  Link as ChakraLink,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { InvoiceCard } from 'components/invoice/InvoiceCard'
import { INVOICE_STATUS } from 'components/invoice/status'
import { PageShell } from 'components/layout/PageShell'
import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatDateTime } from 'lib/format/datetime'
import { formatPrice, formatRupiah } from 'lib/format/money'

import { DepositPanel } from '../DepositPanel'
import { HandoverGallery } from '../HandoverGallery'
import { STATUS, StatusBadges } from '../labels'
import { closingNote, nextStep, type StepAction } from '../nextStep'
import { actionErrorMessage, allowedActions, useBookingActions } from '../useBookingActions'

const REMAH = [{ label: 'Booking', href: '/bookings' }]

/**
 * Satu booking, sebagai halaman.  (S1-029, S1-032, S1-047, S1-048)
 *
 * Dulu modal di atas daftar. Isinya sudah jadi tempat kerja -- catat bayar,
 * bukti transfer, penyelesaian deposit, galeri foto -- dan modal yang memuat
 * form adalah modal yang tertutup tidak sengaja dengan catatan di dalamnya.
 *
 * Disusun untuk juragan yang sebagian sudah berumur: satu langkah berikutnya
 * di paling atas dalam kalimat biasa dengan satu tombol besar, pekerjaan di
 * kolom kiri, konteks di kanan, yang sudah beres dilipat, dan tidak ada
 * dialog di atas dialog. Harga dan deposit tidak dirender untuk operator
 * (BR-003).
 */
export function BookingDetail({ id, initialError }: { id: string; initialError?: string | null }) {
  const router = useRouter()
  const canWrite = useCan('bookings:write')
  const canHandover = useCan('handovers:write')
  const canSeePrices = useCan('pricing:write')
  const atas = useRef<HTMLDivElement>(null)

  // Dari menu baris di daftar (`?err=<kode>`): pesannya tampil di sini, di
  // samping booking yang gagal, lalu URL-nya dibersihkan supaya muat ulang
  // tidak mengulang pesan lama.
  const [pesan, setPesan] = useState<string | null>(initialError ? actionErrorMessage(initialError) : null)
  useEffect(() => {
    if (initialError) router.replace(`/bookings/${id}`, { scroll: false })
  }, [id, initialError, router])

  const aksi = useBookingActions({ onError: (_id, code) => setPesan(actionErrorMessage(code)) })

  const { data: b, isPending, error } = useQuery({
    queryKey: ['bookings', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })
  const { data: invoices } = useQuery({
    queryKey: ['bookings', id, 'invoices'],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices', { params: { query: { booking_id: id } } })
      if (error) throw error
      return data.data
    },
  })
  // Kunci yang sama dengan DepositPanel: satu request, dua pembaca.
  const { data: deposit } = useQuery({
    queryKey: ['bookings', id, 'deposit'],
    enabled: b !== undefined && b.deposit_amount !== null,
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}/deposit', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })

  // Pembaca layar mulai dari ringkasan booking, bukan dari sidebar.
  const siap = b !== undefined
  useEffect(() => {
    if (siap) atas.current?.focus({ preventScroll: true })
  }, [siap])

  if (isPending) {
    return (
      <PageShell title="Booking" width="form-aside" breadcrumb={REMAH}>
        <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" thickness="3px" /></Flex>
      </PageShell>
    )
  }
  if (error !== null || !b) {
    return (
      <PageShell title="Booking" width="form-aside" breadcrumb={REMAH}>
        <Card variant="panel">
          <Text color="text.primary" mb="16px">Booking ini tidak ada di usaha kamu.</Text>
          <Button as={Link} href="/bookings" variant="brand">Kembali ke daftar booking</Button>
        </Card>
      </PageShell>
    )
  }

  const boleh = allowedActions(b)
  const langkah = nextStep(b, deposit, formatRupiah)
  // Slot yang sama: kalau tidak ada langkah, yang tampil adalah penutupnya.
  const penutup = langkah ? null : closingNote(b, formatRupiah)
  const bisa = (a: StepAction) =>
    a === 'confirm' || a === 'complete' ? canWrite
      : a === 'pickup' || a === 'return' ? canHandover
      : true
  function jalankan(a: StepAction) {
    setPesan(null)
    if (a === 'pay' || a === 'settle') {
      // Bukan request: tombol sebenarnya ada di kartunya, karena catat bayar
      // butuh memilih invoice dan caranya. Gulir ke sana dan taruh fokus di
      // judulnya supaya pembaca layar ikut pindah.
      const el = document.getElementById(a === 'pay' ? 'tagihan' : 'deposit')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
      return
    }
    aksi.start(a, b)
  }

  const bayar = b.payment.status === 'none'
    ? null
    : INVOICE_STATUS[b.payment.status] ?? { label: b.payment.status, scheme: 'gray' }
  const unit = b.unit.label ? `${b.unit.label} (${b.unit.code})` : b.unit.code
  const adaBukti = b.status === 'picked_up' || b.status === 'returned' || b.status === 'completed'

  return (
    <PageShell title={b.code} width="form-aside" breadcrumb={REMAH}>
      {/* Tanpa cincin fokus: kotak ini difokus secara programatik saat muat,
          supaya pembaca layar mulai dari ringkasan, dan tidak pernah bisa
          dicapai lewat Tab (tabIndex -1). Cincin cuma akan tampil sebagai
          kotak biru misterius tiap kali halaman di-refresh. */}
      <Box ref={atas} tabIndex={-1} mb="20px" outline="none" _focusVisible={{ outline: 'none', boxShadow: 'none' }}
        aria-label={`Booking ${b.code}, ${STATUS[b.status].label}${b.overdue ? ', terlambat' : ''}`}>
        <Flex align="center" gap="8px" wrap="wrap">
          <StatusBadges booking={b} />
          {bayar && <Badge colorScheme={bayar.scheme}>{bayar.label}</Badge>}
          {b.payment.outstanding > 0 && (
            <Text color="text.secondary">Sisa {formatRupiah(b.payment.outstanding)}</Text>
          )}
        </Flex>
        {/* Hanya di layar sempit: di lg ke atas kolom kanan (Penyewa, Unit &
            jadwal) sudah memikulnya, dan baris ini jadi duplikat. Di HP kolom
            itu jatuh jauh di bawah tagihan, jadi baris ini satu-satunya
            jawaban cepat "booking siapa ini". */}
        <Text color="text.secondary" mt="8px" display={{ base: 'block', lg: 'none' }}>
          <Text as="span" fontWeight="600" color="text.primary">{b.customer.name}</Text>
          {' · '}{b.resource.name} · {unit}
        </Text>
      </Box>

      {pesan && (
        <Card variant="section" role="alert" mb="20px" borderWidth="1px" borderColor="red.300">
          <Text color="text.primary">{pesan}</Text>
        </Card>
      )}

      {langkah && (
        <Card variant="section" mb="20px" borderLeftWidth="4px" borderLeftColor="brand.500">
          <Heading as="h2" size="sm" mb="6px">Langkah berikutnya</Heading>
          <Text color="text.primary" mb="16px">{langkah.hint}</Text>
          {/* Di HP tombolnya selebar kartu: satu ibu jari, tanpa membidik.
              `md`, bukan `sm`: breakpoint sm tema ini 320px, jadi sm = semua HP. */}
          <Flex gap="12px" wrap="wrap" direction={{ base: 'column', md: 'row' }} align="stretch">
            {bisa(langkah.action) && (
              <Button variant="brand" h="48px" px="28px" w={{ base: '100%', md: 'auto' }} isLoading={aksi.pending}
                onClick={() => jalankan(langkah.action)}>
                {langkah.label}
              </Button>
            )}
            {canWrite && boleh.swap && (
              <Button variant="outline" h="48px" w={{ base: '100%', md: 'auto' }}
                onClick={() => { setPesan(null); aksi.start('swap', b) }}>
                Tukar unit
              </Button>
            )}
            {canHandover && boleh.pickup && langkah.action !== 'pickup' && (
              // Bayar saat ambil tetap sah kalau pemilik tidak mewajibkan lunas
              // di muka (BR-038); server yang memutuskan, bukan tombol ini.
              <Button variant="outline" h="48px" w={{ base: '100%', md: 'auto' }} onClick={() => aksi.start('pickup', b)}>
                Serah-terima ambil
              </Button>
            )}
          </Flex>
        </Card>
      )}

      {penutup && (
        <Card variant="section" mb="20px" borderLeftWidth="4px"
          borderLeftColor={penutup.tone === 'danger' ? 'red.500' : 'green.500'}>
          <Heading as="h2" size="sm" mb="6px">{penutup.title}</Heading>
          <Text color="text.primary">{penutup.text}</Text>
        </Card>
      )}

      <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }} gap="20px" alignItems="start">
        <Box>
          <Card variant="section" id="tagihan" mb="20px">
            <Heading as="h2" size="sm" tabIndex={-1} mb="12px" borderRadius="4px" _focusVisible={{ boxShadow: 'outline' }}>
              Tagihan
            </Heading>
            {invoices === undefined && <Spinner size="sm" color="brand.500" />}
            {invoices?.length === 0 && (
              <Text color="text.secondary">Belum ada tagihan. Invoice terbit saat booking dikonfirmasi.</Text>
            )}
            {invoices?.map((inv) => <InvoiceCard key={inv.id} invoice={inv} collapsible />)}
          </Card>
          {b.deposit_amount !== null && (
            <Card variant="section" id="deposit" mb="20px">
              <DepositPanel booking={b} />
            </Card>
          )}
        </Box>

        <Box>
          <Card variant="section" mb="20px">
            <Heading as="h2" size="sm" mb="12px">Penyewa</Heading>
            <Text fontWeight="600" color="text.primary">{b.customer.name}</Text>
            <Flex align="center" gap="8px" wrap="wrap">
              {/* 44px: ini tombol "telepon penyewa", bukan sekadar teks. */}
              <ChakraLink href={`tel:${b.customer.phone}`} color="brand.500" fontWeight="600"
                display="inline-flex" alignItems="center" minH="44px" pe="8px">
                {b.customer.phone}
              </ChakraLink>
              {b.customer.is_blacklisted && <Badge colorScheme="red">diblokir</Badge>}
            </Flex>
          </Card>

          <Card variant="section" mb="20px">
            <Heading as="h2" size="sm" mb="12px">Unit &amp; jadwal</Heading>
            <Baris label="Barang">{b.resource.name}</Baris>
            <Baris label="Unit">{unit}</Baris>
            <Baris label="Mulai">{formatDateTime(b.start_at)}</Baris>
            <Baris label="Selesai">{formatDateTime(b.end_at)}</Baris>
            {b.buffer_minutes > 0 && <Baris label="Unit siap lagi">{formatDateTime(b.end_at_with_buffer)}</Baris>}
            {b.actual_return_at && <Baris label="Dikembalikan">{formatDateTime(b.actual_return_at)}</Baris>}
            {b.status === 'draft' && b.expires_at && <Baris label="Draft hangus">{formatDateTime(b.expires_at)}</Baris>}
            {b.status === 'cancelled' && (
              <Baris label="Dibatalkan">{b.cancelled_reason === 'manual' ? 'oleh petugas' : 'otomatis oleh sistem'}</Baris>
            )}
          </Card>

          {canSeePrices && (
            <Card variant="section" mb="20px">
              <Heading as="h2" size="sm" mb="12px">Harga</Heading>
              <Baris label="Sewa">
                {formatPrice(b.unit_price, b.pricing_unit)} × {b.duration_qty} = {formatRupiah(b.subtotal)}
              </Baris>
              <Baris label="Deposit">{b.deposit_amount === null ? 'Tanpa deposit' : formatRupiah(b.deposit_amount)}</Baris>
              <Baris label="Denda telat">
                {b.late_fee_per_unit === null ? 'Tanpa denda' : formatPrice(b.late_fee_per_unit, b.pricing_unit)}
              </Baris>
            </Card>
          )}

          {adaBukti && (
            <Card variant="section" mb="20px">
              <HandoverGallery bookingId={b.id} />
            </Card>
          )}
        </Box>
      </Grid>

      {canWrite && boleh.cancel && (
        <>
          <Divider borderColor="border.subtle" my="12px" />
          {/* Jauh dari tombol utama, dan merah: satu-satunya aksi di halaman
              ini yang tidak bisa diurungkan. */}
          <Flex justify="flex-end" mb="20px">
            <Button variant="outline" colorScheme="red" h="48px" isDisabled={aksi.pending}
              onClick={() => { setPesan(null); aksi.start('cancel', b) }}>
              Batalkan booking
            </Button>
          </Flex>
        </>
      )}

      {aksi.dialogs}
    </PageShell>
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box mb="10px">
      <Text fontSize="sm" color="text.secondary">{label}</Text>
      <Text color="text.primary" fontWeight="500">{children}</Text>
    </Box>
  )
}
