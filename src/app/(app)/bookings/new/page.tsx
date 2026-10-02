'use client'

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  List,
  ListItem,
  Radio,
  RadioGroup,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useRef, useState } from 'react'

import { FormSection } from 'components/fields/FormSection'
import { SelectField } from 'components/fields/SelectField'
import { PageShell } from 'components/layout/PageShell'
import { useCan } from 'contexts/SessionContext'
import { useIdempotencyKey } from 'hooks/useIdempotencyKey'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatRange, fromJakartaLocal, toJakartaLocal } from 'lib/format/datetime'
import { formatPrice, formatRupiah } from 'lib/format/money'

type Customer = components['schemas']['Customer']
type Conflict = components['schemas']['AffectedBooking']

const CustomerDialog = dynamic(() => import('../../customers/CustomerDialog'))

/** Besok 09:00 dan lusa 09:00 WIB -- titik awal yang paling sering benar. */
function defaultRange(): [string, string] {
  const besok = new Date(Date.now() + 24 * 3600 * 1000)
  const d = toJakartaLocal(besok.toISOString()).slice(0, 10)
  const lusa = toJakartaLocal(new Date(besok.getTime() + 24 * 3600 * 1000).toISOString()).slice(0, 10)
  return [`${d}T09:00`, `${lusa}T09:00`]
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
  const startRef = useRef<HTMLInputElement>(null)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cari, setCari] = useState('')
  const q = useDeferredValue(cari.trim())
  const [dialogBaru, setDialogBaru] = useState(false)

  const [[mulai, selesai], setRentang] = useState(defaultRange)
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
    onSuccess: (b) => router.push(`/bookings/${b.id}`),
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

  function ubahRentang(a: string, b: string) {
    setRentang([a, b])
    setUnitId('')
    setConflicts(null)
    setError(null)
  }

  const bisaSimpan = customer !== null && !customer.is_blacklisted && unitId !== '' && rentangSah

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

        <FormSection title="Jadwal" description="Waktu WIB. Selesai jam 10.00 dan mulai jam 10.00 tidak bentrok.">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
            <FormControl mb="16px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Mulai</FormLabel>
              <Input ref={startRef} type="datetime-local" value={mulai} onChange={(e) => ubahRentang(e.target.value, selesai)} />
            </FormControl>
            <FormControl mb="16px" isInvalid={(mulai !== '' && selesai !== '' && !rentangSah) || error?.field === 'end'}>
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Selesai</FormLabel>
              <Input type="datetime-local" value={selesai} onChange={(e) => ubahRentang(mulai, e.target.value)} />
              <FormErrorMessage>{error?.field === 'end' ? error.message : 'Selesai harus setelah mulai.'}</FormErrorMessage>
            </FormControl>
          </SimpleGrid>
        </FormSection>

        <FormSection title="Unit" description="Hanya unit yang kosong di jadwal itu, jeda bersih-bersih ikut dihitung.">
          {!rentangSah && <Text fontSize="sm" color="text.secondary">Isi jadwal dulu.</Text>}
          {rentangSah && tersedia.isPending && <Spinner size="sm" />}
          {tersedia.data?.length === 0 && (
            <Text fontSize="sm" color="text.secondary">Belum ada barang aktif. Tambahkan barang dan unitnya di menu Barang.</Text>
          )}
          <RadioGroup value={unitId} onChange={(v) => { setUnitId(v); setConflicts(null) }}>
            <Stack spacing="14px">
              {tersedia.data?.map((a) => (
                <Box key={a.resource.id}>
                  <Flex justify="space-between" mb="6px">
                    <Text fontWeight="600" color="text.primary">{a.resource.name}</Text>
                    {canSeePrices && (
                      <Text fontSize="sm" color="text.secondary">
                        {formatPrice(a.resource.base_price, a.resource.pricing_unit)} · {a.duration_qty}× = {formatRupiah(a.subtotal)}
                      </Text>
                    )}
                  </Flex>
                  {a.available_units.length === 0 ? (
                    <Text fontSize="sm" color="text.secondary">Penuh di jadwal ini.</Text>
                  ) : a.available_units.length > 12 ? (
                    // A fleet of 200 is 200 radios; past a dozen a picker reads
                    // faster than a wall of them.
                    <SelectField label={`${a.available_units.length} unit kosong`}
                      value={a.available_units.some((u) => u.id === unitId) ? unitId : ''}
                      onChange={(v) => { setUnitId(v); setConflicts(null) }}
                      options={[{ value: '', label: 'Pilih unit' },
                        ...a.available_units.map((u) => ({ value: u.id, label: u.label ? `${u.label} (${u.code})` : u.code }))]} />
                  ) : (
                    <Flex gap="14px" wrap="wrap">
                      {a.available_units.map((u) => (
                        <Radio key={u.id} value={u.id}>{u.label ? `${u.label} (${u.code})` : u.code}</Radio>
                      ))}
                    </Flex>
                  )}
                </Box>
              ))}
            </Stack>
          </RadioGroup>
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
                  <Button size="sm" variant="outline" onClick={() => { setConflicts(null); startRef.current?.focus() }}>
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

        <Flex justify="flex-end" gap="12px">
          <Button variant="outline" onClick={() => router.push('/bookings')}>Batal</Button>
          <Button type="submit" variant="brand" isDisabled={!bisaSimpan || conflicts !== null} isLoading={simpan.isPending}>
            Simpan booking
          </Button>
        </Flex>
      </Box>

      {dialogBaru && (
        <CustomerDialog isOpen onClose={() => setDialogBaru(false)} customer={null}
          onSaved={(c) => { setCustomer(c); setCari('') }} />
      )}
    </PageShell>
  )
}
