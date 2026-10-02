'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
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
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useDeferredValue, useEffect, useRef, useState } from 'react'

import { DateRangeField, type DateRange } from 'components/fields/DateRangeField'
import { MultiSelectField } from 'components/fields/MultiSelectField'
import type { SelectOption } from 'components/fields/SelectField'
import { SelectField } from 'components/fields/SelectField'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { FilterCard } from 'components/table/FilterCard'
import { TigaTitik } from 'components/table/RowActions'
import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatRange } from 'lib/format/datetime'

import { STATUS, StatusBadges, type BookingStatus } from './labels'
import { unitsQuery } from '../catalog/queries'

import { allowedActions, useBookingActions } from './useBookingActions'

const BookingDialog = dynamic(() => import('./BookingDialog'))

/**
 * Daftar booking.  (S1-030)
 *
 * Berhalaman cursor, jadi SETIAP saring dikirim ke server -- saring di klien
 * hanya akan menyaring halaman yang kebetulan termuat. "Terlambat" adalah
 * sakelar sendiri, bukan pilihan di dropdown status: ia kondisi turunan
 * (`picked_up` + lewat `end_at`), bukan status (BR-041).
 */
export default function BookingsPage() {
  // useSearchParams menuntut Suspense di atasnya saat `next build`.
  return <Suspense><BookingsList /></Suspense>
}

/**
 * Detail booking adalah modal, dan alamatnya `?id=` -- tombol back menutupnya
 * dan tautannya bisa dibagikan. Saring tetap state, jadi membuka dan menutup
 * modal tidak me-reset daftar.
 */
function BookingsList() {
  const router = useRouter()
  const params = useSearchParams()
  const terbuka = params.get('id')
  // Dibuka dari layar ini -> back menutupnya. Datang dari luar (kalender, tautan,
  // selesai simpan) -> back akan keluar dari daftar, jadi tutup dengan replace.
  const dibukaDiSini = useRef(false)
  const [pesan, setPesan] = useState<{ id: string; message: string } | null>(null)
  // Chunk modal diunduh sesudah daftar tampil, supaya klik baris pertama tidak berkedip.
  useEffect(() => { void import('./BookingDialog') }, [])

  function buka(id: string) {
    dibukaDiSini.current = true
    router.push(`/bookings?id=${encodeURIComponent(id)}`, { scroll: false })
  }
  function tutup() {
    setPesan(null)
    if (dibukaDiSini.current) router.back()
    else router.replace('/bookings', { scroll: false })
    dibukaDiSini.current = false
  }

  const aksi = useBookingActions({
    onError: (id, message) => {
      setPesan({ id, message })
      if (terbuka !== id) buka(id)
    },
  })

  const canWrite = useCan('bookings:write')
  const [status, setStatus] = useState('')
  const [overdue, setOverdue] = useState(false)
  const [rentang, setRentang] = useState<DateRange>({ from: '', to: '' })
  const [kode, setKode] = useState('')
  const [plat, setPlat] = useState<SelectOption[]>([])
  const [cariPlat, setCariPlat] = useState('')
  const [penyewa, setPenyewa] = useState<SelectOption[]>([])
  const [barang, setBarang] = useState<SelectOption[]>([])
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
  const opsiBarang = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources')
      if (error) throw error
      return data
    },
  })

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

  // Isian di atas adalah DRAF. Yang dikirim ke server hanya `filter` -- salinan
  // draf saat "Cari" ditekan -- supaya daftar besar tidak di-fetch ulang tiap
  // ketikan dan tiap centang. Yang kosong DIHILANGKAN, bukan dikirim kosong.
  const draf = {
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
  const [filter, setFilter] = useState<typeof draf>({})
  // Rentang adalah dua key (`from`, `to`) tapi satu saring.
  const hitung = (f: typeof draf) => Object.keys(f).filter((k) => k !== 'to').length
  const saringAktif = hitung(filter)

  function cari() {
    setFilter(draf)
  }
  function resetSaring() {
    setStatus(''); setOverdue(false); setRentang({ from: '', to: '' })
    setKode(''); setPlat([]); setPenyewa([]); setBarang([])
    setFilter({})
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
            <MultiSelectField label="Plat nomor" placeholder="Semua unit" value={plat} onChange={setPlat}
              options={platCocok} onSearch={setCariPlat} isLoading={opsiBarang.isPending || opsiPlat.isPending} />
            <MultiSelectField label="Penyewa" placeholder="Semua penyewa" value={penyewa} onChange={setPenyewa}
              options={opsiPenyewa.data ?? []} onSearch={setCariPenyewa} isLoading={opsiPenyewa.isFetching} />
            <MultiSelectField label="Barang" placeholder="Semua barang" value={barang} onChange={setBarang}
              options={(opsiBarang.data ?? []).map((r) => ({ value: r.id, label: r.name }))} isLoading={opsiBarang.isPending} />
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
          <Table variant="simple" minW="820px">
            <Thead>
              <Tr><Th>Kode</Th><Th>Penyewa</Th><Th>Unit</Th><Th>Jadwal</Th><Th>Status</Th><Th w="1%" aria-label="Aksi" /></Tr>
            </Thead>
            <Tbody>
              {rows.map((b) => {
                const boleh = allowedActions(b)
                return (
                  <Tr key={b.id} cursor="pointer" _hover={{ bg: 'surface.hover' }} onClick={() => buka(b.id)}>
                    <Td>
                      {/* Tautan sungguhan: Tab + Enter dan cmd/ctrl-klik tetap jalan. */}
                      <Link href={`/bookings?id=${b.id}`} scroll={false}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                          e.preventDefault()
                          buka(b.id)
                        }}>
                        <Text fontWeight="600" color="text.primary" whiteSpace="nowrap">{b.code}</Text>
                      </Link>
                    </Td>
                    <Td fontSize="sm" color="text.primary">{b.customer.name}</Td>
                    <Td fontSize="sm" color="text.secondary">{b.resource.name} · {b.unit.label ?? b.unit.code}</Td>
                    <Td fontSize="sm" color="text.secondary">{formatRange(b.start_at, b.end_at)}</Td>
                    <Td><StatusBadges booking={b} /></Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Menu placement="bottom-end" flip={false}>
                        <MenuButton as={IconButton} type="button" aria-label={`Aksi ${b.code}`} icon={<TigaTitik />}
                          variant="ghost" minW="44px" h="44px" borderRadius="12px" color="text.secondary"
                          _hover={{ color: 'text.primary', bg: 'surface.hover' }} _active={{ bg: 'surface.hover' }} />
                        {/* Portal wajib: kartu tabel adalah scroll container (lihat RowActions). */}
                        <Portal>
                          <MenuList minW="180px">
                            <MenuItem onClick={() => buka(b.id)}>Lihat detail</MenuItem>
                            {canWrite && boleh.confirm && (
                              <MenuItem onClick={() => aksi.start('confirm', b)} isDisabled={aksi.pending}>Konfirmasi</MenuItem>
                            )}
                            {canWrite && boleh.swap && <MenuItem onClick={() => aksi.start('swap', b)}>Tukar unit</MenuItem>}
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

      {/* Suspense sendiri per dialog lazy: render pertamanya menunggu chunk, dan
          tanpa batas di sini yang ikut menunggu adalah batas terdekat di atas --
          seluruh isi layar hilang sesaat. */}
      <Suspense fallback={null}>
        {terbuka && !aksi.active && (
          <BookingDialog id={terbuka} busy={aksi.pending} onClose={tutup}
            message={pesan?.id === terbuka ? pesan.message : undefined}
            onAction={(kind, b) => { setPesan(null); aksi.start(kind, b) }} />
        )}
      </Suspense>
      {aksi.dialogs}
    </PageShell>
  )
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const n = new Date(Date.UTC(y, m - 1, d + 1))
  return `${n.toISOString().slice(0, 10)}T00:00:00+07:00`
}
