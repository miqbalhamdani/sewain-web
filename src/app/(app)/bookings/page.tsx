'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Badge,
  Button,
  Card,
  Flex,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Portal,
  SimpleGrid,
  Spinner,
  Switch,
  FormControl,
  Input,
  FormLabel,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useDeferredValue, useMemo, useState } from 'react'

import { DateRangeField, type DateRange } from 'components/fields/DateRangeField'
import { MultiSelectField } from 'components/fields/MultiSelectField'
import type { SelectOption } from 'components/fields/SelectField'
import { SelectField } from 'components/fields/SelectField'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { FilterCard } from 'components/table/FilterCard'
import { INVOICE_STATUS } from 'components/invoice/status'
import { TigaTitik } from 'components/table/RowActions'
import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatRange } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

import { STATUS, StatusBadges, type BookingStatus } from './labels'
import { resourcesQuery, unitsQuery } from '../catalog/queries'

import { allowedActions, useBookingActions } from './useBookingActions'

/** Saring yang dikirim ke server. Key yang kosong DIHILANGKAN, bukan dikirim kosong. */
type Saring = {
  code?: string
  unit_id?: string[]
  customer_id?: string[]
  resource_id?: string[]
  status?: BookingStatus
  overdue?: boolean
  from?: string
  to?: string
}

/**
 * Daftar booking.  (S1-030)
 *
 * Berhalaman cursor, jadi SETIAP saring dikirim ke server -- saring di klien
 * hanya akan menyaring halaman yang kebetulan termuat. "Terlambat" adalah
 * sakelar sendiri, bukan pilihan di dropdown status: ia kondisi turunan
 * (`picked_up` + lewat `end_at`), bukan status (BR-041).
 *
 * Saring yang aktif hidup di URL, bukan di state. Detail booking adalah halaman
 * sendiri (`/bookings/[id]`), dan Back dari sana harus mengembalikan daftar
 * persis seperti ditinggalkan -- state komponen sudah hilang saat itu, URL
 * tidak. Bonusnya, saringan bisa dibagikan sebagai tautan.
 */
export default function BookingsPage() {
  // useSearchParams menuntut Suspense di atasnya saat `next build`.
  return <Suspense><BookingsList /></Suspense>
}

function saringDari(params: URLSearchParams): Saring {
  const satu = (k: string) => params.get(k) ?? undefined
  const semua = (k: string) => {
    const v = params.getAll(k)
    return v.length > 0 ? v : undefined
  }
  return {
    ...(satu('code') ? { code: satu('code') } : {}),
    ...(semua('unit_id') ? { unit_id: semua('unit_id') } : {}),
    ...(semua('customer_id') ? { customer_id: semua('customer_id') } : {}),
    ...(semua('resource_id') ? { resource_id: semua('resource_id') } : {}),
    ...(satu('status') ? { status: satu('status') as BookingStatus } : {}),
    ...(params.get('overdue') === '1' ? { overdue: true } : {}),
    ...(satu('from') ? { from: satu('from') } : {}),
    ...(satu('to') ? { to: satu('to') } : {}),
  }
}

function queryDari(s: Saring): string {
  const q = new URLSearchParams()
  if (s.code) q.set('code', s.code)
  s.unit_id?.forEach((v) => q.append('unit_id', v))
  s.customer_id?.forEach((v) => q.append('customer_id', v))
  s.resource_id?.forEach((v) => q.append('resource_id', v))
  if (s.status) q.set('status', s.status)
  if (s.overdue) q.set('overdue', '1')
  if (s.from) q.set('from', s.from)
  if (s.to) q.set('to', s.to)
  return q.toString()
}

/**
 * `from`/`to` di URL adalah timestamp Jakarta; field tanggal cuma mau
 * YYYY-MM-DD. `to` eksklusif (hari sesudah hari terakhir), jadi mundur sehari.
 */
function hariDari(iso: string | undefined, eksklusif = false): string {
  if (!iso) return ''
  const hari = iso.slice(0, 10)
  if (!eksklusif) return hari
  const [y, m, d] = hari.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const n = new Date(Date.UTC(y, m - 1, d + 1))
  return `${n.toISOString().slice(0, 10)}T00:00:00+07:00`
}

/** Chip yang lahir dari URL cuma punya id; labelnya diisi begitu pilihannya termuat. */
const chipDari = (ids: string[]): SelectOption[] => ids.map((v) => ({ value: v, label: v }))
function denganLabel(dipilih: SelectOption[], pilihan: SelectOption[]): SelectOption[] {
  // ponytail: penyewa di luar 20 teratas tetap tampil sebagai id sesudah muat
  // ulang; cari berdasarkan id kalau itu pernah dikeluhkan.
  return dipilih.map((d) => (d.label === d.value ? pilihan.find((o) => o.value === d.value) ?? d : d))
}

function BookingsList() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = useMemo(() => saringDari(params), [params])

  // Gagal dari menu baris butuh konteks bookingnya: antar ke halaman detail
  // dengan kodenya, bukan toast yang hilang dalam lima detik.
  const aksi = useBookingActions({
    onError: (id, code) => router.push(`/bookings/${id}?err=${encodeURIComponent(code)}`),
  })

  const canWrite = useCan('bookings:write')
  const canHandover = useCan('handovers:write')

  // Isian di bawah adalah DRAF, diawali dari URL supaya muat ulang dan Back
  // menampilkan saring yang memang aktif. Yang dikirim ke server hanya
  // `filter` -- URL -- yang baru berubah saat "Cari" ditekan, supaya daftar
  // besar tidak di-fetch ulang tiap ketikan dan tiap centang.
  const [status, setStatus] = useState<string>(filter.status ?? '')
  const [overdue, setOverdue] = useState(filter.overdue === true)
  const [rentang, setRentang] = useState<DateRange>({ from: hariDari(filter.from), to: hariDari(filter.to, true) })
  const [kode, setKode] = useState(filter.code ?? '')
  const [plat, setPlat] = useState<SelectOption[]>(chipDari(filter.unit_id ?? []))
  const [cariPlat, setCariPlat] = useState('')
  const [penyewa, setPenyewa] = useState<SelectOption[]>(chipDari(filter.customer_id ?? []))
  const [barang, setBarang] = useState<SelectOption[]>(chipDari(filter.resource_id ?? []))
  const [cariPenyewa, setCariPenyewa] = useState('')
  const penyewaQ = useDeferredValue(cariPenyewa.trim())

  // Pilihan penyewa dicari di server -- daftarnya berhalaman, jadi 20 teratas
  // yang cocok, bukan "semua penyewa".
  const opsiPenyewa = useQuery({
    queryKey: ['customers', 'pick', penyewaQ],
    queryFn: async () => {
      const { data, error } = await api.GET('/customers', {
        params: { query: { ...(penyewaQ !== '' ? { q: penyewaQ } : {}), limit: 20 } },
      })
      if (error) throw error
      return data.data.map((c) => ({ value: c.id, label: c.name }))
    },
  })
  const opsiBarang = useQuery(resourcesQuery)
  const pilihanBarang = (opsiBarang.data ?? []).map((r) => ({ value: r.id, label: r.name }))

  // Unit tidak punya daftar datar di API: satu GET per barang. Armada fase 1
  // hitungan puluhan, dan query-nya berbagi cache dengan layar unit.
  // ponytail: N request; GET /units kalau barangnya sudah ratusan.
  const opsiPlat = useQueries({
    queries: (opsiBarang.data ?? []).map((r) => unitsQuery(r.id)),
    combine: (hasil) => ({
      isPending: hasil.some((h) => h.isPending),
      data: hasil.flatMap((h) => h.data ?? []).map((u) => ({ value: u.id, label: u.label ? `${u.code} · ${u.label}` : u.code })),
    }),
  })
  const platCocok = opsiPlat.data.filter((o) =>
    o.label.toLowerCase().replace(/\s/g, '').includes(cariPlat.toLowerCase().replace(/\s/g, '')))

  const draf: Saring = {
    ...(kode.trim() !== '' ? { code: kode.trim() } : {}),
    ...(plat.length > 0 ? { unit_id: plat.map((o) => o.value) } : {}),
    ...(penyewa.length > 0 ? { customer_id: penyewa.map((o) => o.value) } : {}),
    ...(barang.length > 0 ? { resource_id: barang.map((o) => o.value) } : {}),
    ...(status !== '' ? { status: status as BookingStatus } : {}),
    ...(overdue ? { overdue: true } : {}),
    // Tanggal kalender di Jakarta; `to` eksklusif, jadi hari terakhir ikut.
    ...(rentang.from !== '' ? { from: `${rentang.from}T00:00:00+07:00` } : {}),
    ...(rentang.to !== '' ? { to: nextDay(rentang.to) } : {}),
  }
  // Rentang adalah dua key (`from`, `to`) tapi satu saring.
  const hitung = (f: Saring) => Object.keys(f).filter((k) => k !== 'to').length
  const saringAktif = hitung(filter)

  function cari() {
    const q = queryDari(draf)
    router.replace(q === '' ? '/bookings' : `/bookings?${q}`, { scroll: false })
  }
  function resetSaring() {
    setStatus(''); setOverdue(false); setRentang({ from: '', to: '' })
    setKode(''); setPlat([]); setPenyewa([]); setBarang([])
    router.replace('/bookings', { scroll: false })
  }

  const query = useInfiniteQuery({
    queryKey: ['bookings', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET('/bookings', {
        params: { query: { ...filter, ...(pageParam ? { cursor: pageParam } : {}) } },
      })
      if (error) throw error
      return data
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  const rows = query.data?.pages.flatMap((p) => p.data) ?? []
  const kosongTotal = !query.isPending && rows.length === 0 && saringAktif === 0

  const buat = canWrite && (
    <Button as={Link} href="/bookings/new" variant="brand" leftIcon={<AddIcon />}>Buat booking</Button>
  )

  return (
    <PageShell title="Booking" subtitle="Semua booking, terbaru di atas." action={!kosongTotal && buat}>
      {kosongTotal && (
        <EmptyState
          title="Belum ada booking"
          description="Buat booking pertama: pilih penyewa, tanggal, lalu unit yang masih kosong."
          action={buat && <Flex justify="center">{buat}</Flex>}
        />
      )}

      {!kosongTotal && (
        <FilterCard activeCount={saringAktif > 0 ? saringAktif : hitung(draf)} onReset={resetSaring} onSubmit={cari}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="0px 20px" alignItems="end">
            <FormControl mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">Kode</FormLabel>
              <Input value={kode} onChange={(e) => setKode(e.target.value)} placeholder="SWN-0001" autoComplete="off" />
            </FormControl>
            <MultiSelectField label="Plat nomor" placeholder="Semua unit" value={denganLabel(plat, opsiPlat.data)} onChange={setPlat}
              options={platCocok} onSearch={setCariPlat} isLoading={opsiBarang.isPending || opsiPlat.isPending} />
            <MultiSelectField label="Penyewa" placeholder="Semua penyewa" value={denganLabel(penyewa, opsiPenyewa.data ?? [])} onChange={setPenyewa}
              options={opsiPenyewa.data ?? []} onSearch={setCariPenyewa} isLoading={opsiPenyewa.isFetching} />
            <MultiSelectField label="Barang" placeholder="Semua barang" value={denganLabel(barang, pilihanBarang)} onChange={setBarang}
              options={pilihanBarang} isLoading={opsiBarang.isPending} />
            <SelectField label="Status" value={status} onChange={setStatus}
              options={[{ value: '', label: 'Semua status' },
                ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
            <DateRangeField label="Rentang" value={rentang} onChange={setRentang} />
            <FormControl display="flex" alignItems="center" h="48px" mb="20px">
              <Switch id="telat" isChecked={overdue} onChange={(e) => setOverdue(e.target.checked)} me="10px" />
              <FormLabel htmlFor="telat" mb="0" fontSize="sm" color="text.primary">Hanya yang terlambat</FormLabel>
            </FormControl>
          </SimpleGrid>
        </FilterCard>
      )}

      {query.isPending && <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" thickness="3px" /></Flex>}
      {query.error !== null && !query.isPending && (
        <Card variant="panel" role="alert"><Text color="text.primary">Daftar booking gagal dimuat. Muat ulang halaman ini.</Text></Card>
      )}

      {!query.isPending && !kosongTotal && (
        <Card variant="table">
          <Table variant="simple" minW="900px">
            <Thead>
              <Tr><Th>Kode</Th><Th>Penyewa</Th><Th>Unit</Th><Th>Jadwal</Th><Th>Status</Th><Th>Bayar</Th><Th w="1%" aria-label="Aksi" /></Tr>
            </Thead>
            <Tbody>
              {rows.map((b) => {
                const boleh = allowedActions(b)
                const detail = `/bookings/${b.id}`
                return (
                  <Tr key={b.id} cursor="pointer" _hover={{ bg: 'surface.hover' }} onClick={() => router.push(detail)}>
                    <Td>
                      {/* Tautan sungguhan: Tab + Enter dan cmd/ctrl-klik tetap jalan.
                          Klik di sel lain ditangani baris di atas. */}
                      <Link href={detail} onClick={(e) => e.stopPropagation()}>
                        <Text fontWeight="600" color="text.primary" whiteSpace="nowrap">{b.code}</Text>
                      </Link>
                    </Td>
                    <Td fontSize="sm" color="text.primary">{b.customer.name}</Td>
                    <Td fontSize="sm" color="text.secondary">{b.resource.name} · {b.unit.label ?? b.unit.code}</Td>
                    <Td fontSize="sm" color="text.secondary">{formatRange(b.start_at, b.end_at)}</Td>
                    <Td><StatusBadges booking={b} /></Td>
                    <Td>
                      {/* Kata & warnanya INVOICE_STATUS -- daftar Booking dan
                          daftar Tagihan tidak boleh menyebut hal yang sama
                          dengan dua kata (ide booking-invoice-lists). */}
                      {b.payment.status === 'none' ? (
                        <Text fontSize="sm" color="text.secondary">—</Text>
                      ) : (
                        <>
                          <Badge colorScheme={INVOICE_STATUS[b.payment.status]?.scheme ?? 'gray'}>
                            {INVOICE_STATUS[b.payment.status]?.label ?? b.payment.status}
                          </Badge>
                          {b.payment.outstanding > 0 && (
                            <Text fontSize="sm" color="text.secondary" mt="4px" whiteSpace="nowrap">
                              Sisa {formatRupiah(b.payment.outstanding)}
                            </Text>
                          )}
                        </>
                      )}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Menu placement="bottom-end" flip={false}>
                        <MenuButton as={IconButton} type="button" aria-label={`Aksi ${b.code}`} icon={<TigaTitik />}
                          variant="ghost" minW="44px" h="44px" borderRadius="12px" color="text.secondary"
                          _hover={{ color: 'text.primary', bg: 'surface.hover' }} _active={{ bg: 'surface.hover' }} />
                        {/* Portal wajib: kartu tabel adalah scroll container (lihat RowActions). */}
                        <Portal>
                          <MenuList minW="180px">
                            <MenuItem onClick={() => router.push(detail)}>Lihat detail</MenuItem>
                            {canWrite && boleh.confirm && (
                              <MenuItem onClick={() => aksi.start('confirm', b)} isDisabled={aksi.pending}>Konfirmasi</MenuItem>
                            )}
                            {canWrite && boleh.swap && <MenuItem onClick={() => aksi.start('swap', b)}>Tukar unit</MenuItem>}
                            {canHandover && boleh.pickup && <MenuItem onClick={() => aksi.start('pickup', b)}>Serah-terima ambil</MenuItem>}
                            {canHandover && boleh.return && <MenuItem onClick={() => aksi.start('return', b)}>Terima kembali</MenuItem>}
                            {canWrite && boleh.complete && <MenuItem onClick={() => aksi.start('complete', b)}>Selesaikan</MenuItem>}
                            {canWrite && boleh.cancel && (
                              <>
                                <MenuDivider />
                                <MenuItem color="red.500" onClick={() => aksi.start('cancel', b)}>Batalkan</MenuItem>
                              </>
                            )}
                          </MenuList>
                        </Portal>
                      </Menu>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
          {rows.length === 0 && (
            <Text fontSize="sm" color="text.secondary" textAlign="center" py="40px">Tidak ada booking yang cocok dengan saringan ini.</Text>
          )}
          {query.hasNextPage && (
            <Flex justify="center" py="16px">
              <Button variant="outline" size="sm" isLoading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                Muat lebih banyak
              </Button>
            </Flex>
          )}
        </Card>
      )}

      {aksi.dialogs}
    </PageShell>
  )
}
