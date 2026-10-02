'use client'

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  FormControl,
  FormLabel,
  Input,
  List,
  ListItem,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  Text,
  useRadioGroup,
} from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Suspense, useDeferredValue, useRef, useState } from 'react'

import { DateRangeField, type DateRange } from 'components/fields/DateRangeField'

import { FormSection } from 'components/fields/FormSection'
import { SelectField } from 'components/fields/SelectField'
import { PageShell } from 'components/layout/PageShell'
import { useCan } from 'contexts/SessionContext'
import { useIdempotencyKey } from 'hooks/useIdempotencyKey'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDayTime, formatRange, fromISODate, fromJakartaLocal, toJakartaLocal } from 'lib/format/datetime'
import { formatPrice, formatRupiah, UNIT_LABEL } from 'lib/format/money'

import { UNIT_GRID, UnitCard, unitName } from '../UnitCard'

type Customer = components['schemas']['Customer']
type Conflict = components['schemas']['AffectedBooking']

const CustomerDialog = dynamic(() => import('../../customers/CustomerDialog'))

/** Besok dan lusa di Jakarta, jam 09.00 -- titik awal yang paling sering benar. */
function defaultRange(): DateRange {
  const besok = new Date(Date.now() + 24 * 3600 * 1000)
  const from = toJakartaLocal(besok.toISOString()).slice(0, 10)
  const to = toJakartaLocal(new Date(besok.getTime() + 24 * 3600 * 1000).toISOString()).slice(0, 10)
  return { from, to }
}


/**
 * Form booking.  (S1-029)
 *
 * Tiga langkah di satu layar, urut seperti telepon masuk: siapa, kapan, unit
 * mana. Unitnya dipilih dari `/availability`, jadi yang tampil memang kosong
 * -- tapi itu tetap bukan jaminan: operator lain bisa menyimpan di detik yang
 * sama. `409 booking-conflict` karena itu menampilkan booking yang bentrok
 * beserta dua jalan keluar, dan TIDAK PERNAH dicoba ulang otomatis (BR-022).
 */
export default function NewBookingPage() {
  const router = useRouter()
  const canSeePrices = useCan('pricing:write')
  const [idemKey, renewKey] = useIdempotencyKey()
  // Ref di Box pembungkus, bukan di tombol pemetik: PopoverTrigger membaca
  // `element.ref` anaknya, dan React 19 memperingatkan itu.
  const tanggalRef = useRef<HTMLDivElement>(null)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cari, setCari] = useState('')
  const q = useDeferredValue(cari.trim())
  const [dialogBaru, setDialogBaru] = useState(false)

  const [tanggal, setTanggal] = useState(defaultRange)
  const [jamMulai, setJamMulai] = useState('09:00')
  const [jamSelesai, setJamSelesai] = useState('09:00')
  // Tanggal dari pemetik + jam dari kotaknya = nilai yang sama yang dulu ditulis
  // <input type="datetime-local">, jadi semua di bawah ini tidak berubah.
  const mulai = tanggal.from !== '' && jamMulai !== '' ? `${tanggal.from}T${jamMulai}` : ''
  const selesai = tanggal.to !== '' && jamSelesai !== '' ? `${tanggal.to}T${jamSelesai}` : ''
  const [unitId, setUnitId] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)

  const rentangSah = mulai !== '' && selesai !== '' && selesai > mulai

  const hasilCari = useQuery({
    queryKey: ['customers', 'pick', q],
    enabled: customer === null && q !== '',
    queryFn: async () => {
      const { data, error } = await api.GET('/customers', { params: { query: { q, limit: 8 } } })
      if (error) throw error
      return data.data
    },
  })

  const tersedia = useQuery({
    queryKey: ['availability', mulai, selesai],
    enabled: rentangSah,
    queryFn: async () => {
      const { data, error } = await api.GET('/availability', {
        params: { query: { start_at: fromJakartaLocal(mulai), end_at: fromJakartaLocal(selesai) } },
      })
      if (error) throw error
      return data.data
    },
  })

  const simpan = useMutation({
    retry: false, // 409 tidak pernah dicoba ulang otomatis
    mutationFn: async () => {
      const { data, error } = await api.POST('/bookings', {
        params: { header: { 'Idempotency-Key': idemKey } },
        body: {
          customer_id: customer!.id,
          resource_unit_id: unitId,
          start_at: fromJakartaLocal(mulai),
          end_at: fromJakartaLocal(selesai),
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: (b) => router.replace(`/bookings?id=${b.id}`),
    onError: (problem) => {
      // The server stores a 4xx under this key and replays it for every later
      // submit with the same key -- so once it has ANSWERED, the next submit
      // (another unit, another date) is a new intent and needs a new key.
      // Only no-answer-yet keeps it: a network failure, or request-in-flight.
      const code = problemCode(problem)
      if (code !== '' && code !== 'request-in-flight') renewKey()
      switch (code) {
        case 'booking-conflict':
          setConflicts((problem as { conflicts?: Conflict[] }).conflicts ?? [])
          return
        case 'customer-blacklisted':
          return setError({ field: 'customer', message: 'Penyewa ini diblokir dan tidak bisa dibooking.' })
        case 'duration-out-of-range': {
          // detail: "...rented for at least 2 hari." -- angka dan satuannya
          // dari server, kalimatnya milik layar ini.
          const m = (problem as { detail?: string }).detail?.match(/at (least|most) (\d+) (\w+)/)
          return setError({ field: 'end', message: m
            ? `Barang ini disewa ${m[1] === 'least' ? 'minimal' : 'maksimal'} ${m[2]} ${m[3]}.`
            : 'Durasinya di luar batas barang ini.' })
        }
        case 'request-in-flight':
          return setError({ message: 'Booking ini masih diproses. Tunggu sebentar — jangan tekan simpan lagi.' })
        default:
          return setError({ message: 'Booking gagal disimpan. Coba lagi.' })
      }
    },
  })

  function ubahJadwal(next: { tanggal?: DateRange; jamMulai?: string; jamSelesai?: string }) {
    if (next.tanggal) setTanggal(next.tanggal)
    if (next.jamMulai !== undefined) setJamMulai(next.jamMulai)
    if (next.jamSelesai !== undefined) setJamSelesai(next.jamSelesai)
    setUnitId('')
    setConflicts(null)
    setError(null)
  }

  const bisaSimpan = customer !== null && !customer.is_blacklisted && unitId !== '' && rentangSah

  // Yang masih punya unit kosong di atas; yang penuh cukup disebut namanya.
  const adaKosong = tersedia.data?.filter((a) => a.available_units.length > 0) ?? []
  const penuh = tersedia.data?.filter((a) => a.available_units.length === 0) ?? []
  const pilihan = adaKosong.flatMap((a) => a.available_units.map((u) => ({ a, u }))).find((x) => x.u.id === unitId)
  const durasi = tersedia.data?.[0]
  const salahJadwal = error?.field === 'end'
    ? error.message
    : mulai !== '' && selesai !== '' && !rentangSah ? 'Kembali harus setelah ambil.' : undefined

  const unitGroup = useRadioGroup({
    name: 'unit',
    value: unitId,
    onChange: (v) => { setUnitId(v); setConflicts(null) },
  })

  return (
    <PageShell title="Buat booking" width="form" breadcrumb={[{ label: 'Booking', href: '/bookings' }]}>
      <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setError(null); setConflicts(null); simpan.mutate() }}>
        <FormSection title="Penyewa">
          {customer === null ? (
            <FormControl isInvalid={error?.field === 'customer'}>
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Cari nama atau telepon</FormLabel>
              <Input autoFocus value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Budi / 0812…" />
              {q !== '' && (
                <List mt="8px" borderWidth="1px" borderColor="border.subtle" borderRadius="12px" overflow="hidden">
                  {hasilCari.isPending && <ListItem p="10px"><Spinner size="sm" /></ListItem>}
                  {hasilCari.data?.map((c) => (
                    <ListItem key={c.id} as="button" type="button" w="100%" textAlign="left" p="10px 14px"
                      _hover={{ bg: 'surface.hover' }} onClick={() => setCustomer(c)}>
                      <Text fontWeight="600" color="text.primary">{c.name}{c.is_blacklisted && ' · diblokir'}</Text>
                      <Text fontSize="xs" color="text.secondary">{c.phone}</Text>
                    </ListItem>
                  ))}
                  {hasilCari.data?.length === 0 && (
                    <ListItem p="10px 14px" fontSize="sm" color="text.secondary">Tidak ada penyewa itu.</ListItem>
                  )}
                </List>
              )}
              <Button mt="10px" size="sm" variant="link" colorScheme="brand" onClick={() => setDialogBaru(true)}>
                + Penyewa baru
              </Button>
            </FormControl>
          ) : (
            <Stack spacing="12px">
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontWeight="700" color="text.primary">{customer.name}</Text>
                  <Text fontSize="sm" color="text.secondary">{customer.phone}</Text>
                </Box>
                <Button size="sm" variant="outline" onClick={() => { setCustomer(null); setError(null) }}>Ganti</Button>
              </Flex>
              {/* Peringatan muncul begitu penyewa dipilih, bukan setelah simpan
                  ditolak -- beserta alasannya, yang memang hak operator (BR-028). */}
              {customer.is_blacklisted && (
                <Alert status="error" borderRadius="12px">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">Penyewa ini diblokir</AlertTitle>
                    <AlertDescription fontSize="sm">{customer.blacklist_reason}</AlertDescription>
                  </Box>
                </Alert>
              )}
            </Stack>
          )}
        </FormSection>

        <FormSection title="Jadwal" description="Waktu WIB. Kembali jam 10.00 dan ambil jam 10.00 tidak bentrok.">
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="0px 16px">
            <Box gridColumn="span 2" ref={tanggalRef}>
              <DateRangeField label="Tanggal sewa" value={tanggal} placeholder="Pilih tanggal ambil – kembali"
                clearable={false} minDate={fromISODate(defaultRange().from) ?? undefined}
                error={salahJadwal} onChange={(t) => ubahJadwal({ tanggal: t })} />
            </Box>
            <FormControl mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Jam ambil</FormLabel>
              <Input type="time" value={jamMulai} onChange={(e) => ubahJadwal({ jamMulai: e.target.value })} />
            </FormControl>
            <FormControl mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Jam kembali</FormLabel>
              <Input type="time" value={jamSelesai} onChange={(e) => ubahJadwal({ jamSelesai: e.target.value })} />
            </FormControl>
          </SimpleGrid>
          {rentangSah && (
            <Text fontSize="sm" color="text.secondary" mt="-4px" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {durasi && (
                <Text as="span" fontWeight="700" color="text.primary">
                  {durasi.duration_qty} {UNIT_LABEL[durasi.resource.pricing_unit] ?? durasi.resource.pricing_unit} ·{' '}
                </Text>
              )}
              ambil {formatDayTime(fromJakartaLocal(mulai))} → kembali {formatDayTime(fromJakartaLocal(selesai))} WIB
            </Text>
          )}
        </FormSection>

        <FormSection title="Unit" description="Hanya unit yang kosong di jadwal itu. Jeda bersih-bersih ikut dihitung.">
          {!rentangSah && <Text fontSize="sm" color="text.secondary">Pilih tanggal dulu.</Text>}
          {rentangSah && tersedia.isPending && (
            <SimpleGrid templateColumns={UNIT_GRID} gap="12px">
              {[0, 1, 2].map((i) => <Skeleton key={i} h="60px" borderRadius="12px" />)}
            </SimpleGrid>
          )}
          {tersedia.data?.length === 0 && (
            <Text fontSize="sm" color="text.secondary">Belum ada barang aktif. Tambahkan barang dan unitnya di menu Barang.</Text>
          )}
          {tersedia.data && tersedia.data.length > 0 && adaKosong.length === 0 && (
            <Text fontSize="sm" color="text.primary" fontWeight="500">Semua unit penuh di jadwal ini. Coba tanggal lain.</Text>
          )}

          <Stack spacing="24px" {...unitGroup.getRootProps()}>
            {adaKosong.map((a) => (
              <Box key={a.resource.id}>
                <Flex justify="space-between" align="baseline" gap="12px" mb="10px" wrap="wrap">
                  <Flex align="center" gap="8px">
                    <Text fontWeight="700" color="text.primary">{a.resource.name}</Text>
                    <Badge colorScheme="green" textTransform="none" fontWeight="600">
                      {a.available_units.length} unit kosong
                    </Badge>
                  </Flex>
                  {canSeePrices && (
                    <Text fontSize="sm" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatPrice(a.resource.base_price, a.resource.pricing_unit)} × {a.duration_qty} ={' '}
                      <Text as="span" fontWeight="700" color="text.primary">{formatRupiah(a.subtotal)}</Text>
                    </Text>
                  )}
                </Flex>
                {a.available_units.length > 12 ? (
                  // Armada 200 unit adalah 200 kartu; lewat selusin, pemilih lebih cepat dibaca.
                  <SelectField label="Pilih unit"
                    value={a.available_units.some((u) => u.id === unitId) ? unitId : ''}
                    onChange={(v) => { setUnitId(v); setConflicts(null) }}
                    options={[{ value: '', label: 'Pilih unit' },
                      ...a.available_units.map((u) => ({ value: u.id, label: u.label ? `${u.label} (${u.code})` : u.code }))]} />
                ) : (
                  <SimpleGrid templateColumns={UNIT_GRID} gap="12px">
                    {a.available_units.map((u) => (
                      <UnitCard key={u.id} unit={u} {...unitGroup.getRadioProps({ value: u.id })} />
                    ))}
                  </SimpleGrid>
                )}
              </Box>
            ))}
          </Stack>

          {adaKosong.length > 0 && penuh.length > 0 && (
            <Text fontSize="sm" color="text.secondary" mt="20px">
              Penuh di jadwal ini: {penuh.map((a) => a.resource.name).join(', ')}
            </Text>
          )}
        </FormSection>

        {conflicts !== null && (
          <Alert status="warning" borderRadius="12px" mb="20px" alignItems="flex-start" role="alert">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle fontSize="sm">Unit ini baru saja dipakai booking lain</AlertTitle>
              <AlertDescription fontSize="sm">
                {conflicts.map((c) => (
                  <Text key={c.code}>{c.code} · {formatRange(c.start_at, c.end_at)}</Text>
                ))}
                <Flex gap="10px" mt="10px">
                  <Button size="sm" variant="outline" onClick={() => { setUnitId(''); setConflicts(null); void tersedia.refetch() }}>
                    Pilih unit lain
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setConflicts(null); tanggalRef.current?.querySelector('button')?.focus() }}>
                    Ubah tanggal
                  </Button>
                </Flex>
              </AlertDescription>
            </Box>
          </Alert>
        )}
        {error !== null && error.field === undefined && (
          <Card variant="panel" role="alert" mb="20px"><Text color="text.primary" fontSize="sm">{error.message}</Text></Card>
        )}

        <Flex justify="flex-end" align="center" gap="12px" wrap="wrap">
          <Text flex="1" flexBasis={{ base: '100%', md: 'auto' }} fontSize="sm" color={pilihan ? 'text.primary' : 'text.secondary'} aria-live="polite"
            sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {pilihan && `${pilihan.a.resource.name} · ${unitName(pilihan.u)}${canSeePrices ? ` · ${formatRupiah(pilihan.a.subtotal)}` : ''}`}
            {pilihan && customer === null && ' — pilih penyewanya dulu.'}
            {!pilihan && !bisaSimpan && 'Pilih penyewa, tanggal, dan unit dulu.'}
          </Text>
          <Button variant="outline" onClick={() => router.push('/bookings')}>Batal</Button>
          <Button type="submit" variant="brand" isDisabled={!bisaSimpan || conflicts !== null} isLoading={simpan.isPending}>
            Simpan booking
          </Button>
        </Flex>
      </Box>

      {/* Suspense sendiri per dialog lazy: render pertamanya menunggu chunk, dan
          tanpa batas di sini yang ikut menunggu adalah batas terdekat di atas --
          seluruh isi layar hilang sesaat. */}
      <Suspense fallback={null}>
        {dialogBaru && (
          <CustomerDialog isOpen onClose={() => setDialogBaru(false)} customer={null}
            onSaved={(c) => { setCustomer(c); setCari('') }} />
        )}
      </Suspense>
    </PageShell>
  )
}

