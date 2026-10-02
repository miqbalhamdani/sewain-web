'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Button,
  Card,
  Flex,
  SimpleGrid,
  Spinner,
  Switch,
  FormControl,
  FormLabel,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { DateRangeField, type DateRange } from 'components/fields/DateRangeField'
import { SelectField } from 'components/fields/SelectField'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { FilterCard } from 'components/table/FilterCard'
import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatRange } from 'lib/format/datetime'

import { STATUS, StatusBadges, type BookingStatus } from './labels'

/**
 * Daftar booking.  (S1-030)
 *
 * Berhalaman cursor, jadi SETIAP saring dikirim ke server -- saring di klien
 * hanya akan menyaring halaman yang kebetulan termuat. "Terlambat" adalah
 * sakelar sendiri, bukan pilihan di dropdown status: ia kondisi turunan
 * (`picked_up` + lewat `end_at`), bukan status (BR-041).
 */
export default function BookingsPage() {
  const canWrite = useCan('bookings:write')
  const [status, setStatus] = useState('')
  const [overdue, setOverdue] = useState(false)
  const [rentang, setRentang] = useState<DateRange>({ from: '', to: '' })

  const filter = {
    ...(status !== '' ? { status: status as BookingStatus } : {}),
    ...(overdue ? { overdue: true } : {}),
    // Tanggal kalender di Jakarta; `to` eksklusif, jadi hari terakhir ikut.
    ...(rentang.from !== '' ? { from: `${rentang.from}T00:00:00+07:00` } : {}),
    ...(rentang.to !== '' ? { to: nextDay(rentang.to) } : {}),
  }
  const saringAktif = (status !== '' ? 1 : 0) + (overdue ? 1 : 0) + (rentang.from !== '' ? 1 : 0)

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
        <FilterCard activeCount={saringAktif} onReset={() => { setStatus(''); setOverdue(false); setRentang({ from: '', to: '' }) }}>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="0px 20px" alignItems="end">
            <SelectField label="Status" value={status} onChange={setStatus}
              options={[{ value: '', label: 'Semua status' },
                ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
            <DateRangeField label="Rentang" value={rentang} onChange={setRentang} />
            <FormControl display="flex" alignItems="center" mb="20px">
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
          <Table variant="simple" minW="760px">
            <Thead>
              <Tr><Th>Kode</Th><Th>Penyewa</Th><Th>Unit</Th><Th>Jadwal</Th><Th>Status</Th></Tr>
            </Thead>
            <Tbody>
              {rows.map((b) => (
                <Tr key={b.id} _hover={{ bg: 'surface.hover' }}>
                  <Td><Link href={`/bookings/${b.id}`}><Text fontWeight="600" color="text.primary" whiteSpace="nowrap">{b.code}</Text></Link></Td>
                  <Td fontSize="sm" color="text.primary">{b.customer.name}</Td>
                  <Td fontSize="sm" color="text.secondary">{b.resource.name} · {b.unit.label ?? b.unit.code}</Td>
                  <Td fontSize="sm" color="text.secondary">{formatRange(b.start_at, b.end_at)}</Td>
                  <Td><StatusBadges booking={b} /></Td>
                </Tr>
              ))}
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
    </PageShell>
  )
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const n = new Date(Date.UTC(y, m - 1, d + 1))
  return `${n.toISOString().slice(0, 10)}T00:00:00+07:00`
}
