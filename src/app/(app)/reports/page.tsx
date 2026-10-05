'use client'

import {
  Box, Button, Card, Flex, Progress, SimpleGrid, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr,
} from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { DateRangeField, type DateRange } from 'components/fields/DateRangeField'
import { SelectField } from 'components/fields/SelectField'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime, fromISODate, toISODate } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type ExportRequest = components['schemas']['ExportRequest']

/** The period as the API takes it: whole WIB days, `to` exclusive. */
function periodOf(r: DateRange) {
  const end = fromISODate(r.to) ?? new Date()
  end.setDate(end.getDate() + 1)
  return { from: `${r.from}T00:00:00+07:00`, to: `${toISODate(end)}T00:00:00+07:00` }
}

function thisMonth(): DateRange {
  const now = new Date()
  return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISODate(now) }
}

function unitName(u: components['schemas']['UnitRef']) {
  return u.label ? `${u.code} (${u.label})` : u.code
}

/**
 * Laporan -- owner only.  (S1-064, BR-003, BR-075 .. BR-077)
 *
 * Revenue is cash basis: what came in during the period. Deposit is held
 * money, never revenue, so it has its own block and never joins the total
 * (BR-050). Exports are built in the background; this screen keeps working
 * while it waits.
 */
export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(thisMonth)
  const period = periodOf(range)

  const revenue = useQuery({
    queryKey: ['reports', 'revenue', period],
    queryFn: async () => {
      const { data, error } = await api.GET('/reports/revenue', { params: { query: period } })
      if (error) throw error
      return data
    },
  })
  const usage = useQuery({
    queryKey: ['reports', 'utilization', period],
    queryFn: async () => {
      const { data, error } = await api.GET('/reports/utilization', { params: { query: period } })
      if (error) throw error
      return data.data
    },
  })
  const idle = useQuery({
    queryKey: ['reports', 'idle-units'],
    queryFn: async () => {
      const { data, error } = await api.GET('/reports/idle-units')
      if (error) throw error
      return data.data
    },
  })
  const late = useQuery({
    queryKey: ['bookings', 'overdue-report'],
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings', { params: { query: { overdue: true, limit: 50 } } })
      if (error) throw error
      return data.data
    },
  })

  const noUnits = usage.data !== undefined && usage.data.length === 0
  const failed = [revenue, usage, idle, late].some((q) => q.error !== null)

  return (
    <PageShell title="Laporan" subtitle="Pemasukan dihitung saat uang masuk. Deposit dicatat terpisah — itu titipan, bukan pendapatan.">
      <Card variant="section" mb="20px">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="0 20px">
          <DateRangeField label="Periode" value={range} clearable={false} placeholder="Pilih periode"
            onChange={(r) => { if (r.from !== '' && r.to !== '') setRange(r) }} helper="Maksimal 366 hari." />
        </SimpleGrid>
      </Card>

      {failed && <Card variant="panel" role="alert" mb="20px"><Text color="text.primary">Sebagian laporan gagal dimuat. Muat ulang halaman ini.</Text></Card>}

      {noUnits ? (
        <EmptyState title="Belum ada yang bisa dilaporkan"
          description="Laporan dihitung dari unit dan booking. Mulai dengan menambah barang dan unitnya."
          action={<Flex justify="center"><Button as={Link} href="/catalog/new" variant="brand">Tambah barang</Button></Flex>} />
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="20px" mb="20px">
            <Card p="20px">
              <Text fontWeight="700" color="text.primary" mb="12px">Pemasukan</Text>
              {revenue.isPending ? <Spinner color="brand.500" /> : revenue.data && (
                <>
                  <Row label="Sewa" value={revenue.data.revenue.rent} />
                  <Row label="Denda telat" value={revenue.data.revenue.late_fee} />
                  <Row label="Kerusakan" value={revenue.data.revenue.damage} />
                  <Row label="Diskon" value={revenue.data.revenue.discount} />
                  <Row label="Total pemasukan" value={revenue.data.revenue.total} strong />
                </>
              )}
            </Card>
            <Card p="20px">
              <Text fontWeight="700" color="text.primary" mb="4px">Deposit (titipan)</Text>
              <Text fontSize="xs" color="text.secondary" mb="12px">Uang penyewa yang kamu pegang. Tidak masuk total pemasukan.</Text>
              {revenue.isPending ? <Spinner color="brand.500" /> : revenue.data && (
                <>
                  <Row label="Masuk di periode ini" value={revenue.data.deposit_held.in} />
                  <Row label="Dikembalikan di periode ini" value={revenue.data.deposit_held.returned} />
                  <Row label="Masih ditahan sekarang" value={revenue.data.deposit_held.balance} strong />
                </>
              )}
            </Card>
          </SimpleGrid>

          <ExportCard period={period} />

          <Card variant="table" mb="20px">
            <Text fontWeight="700" color="text.primary" px="20px" pt="20px">Pemakaian unit</Text>
            <Text fontSize="xs" color="text.secondary" px="20px" mb="8px">Hari disewa di periode ini, yang paling jarang dipakai di atas.</Text>
            {usage.isPending ? <Flex py="30px" justify="center"><Spinner color="brand.500" /></Flex> : (
              <Table variant="simple" minW="640px">
                <Thead><Tr><Th>Unit</Th><Th>Barang</Th><Th isNumeric>Hari disewa</Th><Th w="35%">Pemakaian</Th></Tr></Thead>
                <Tbody>
                  {usage.data?.map((u) => (
                    <Tr key={u.unit.id}>
                      <Td fontSize="sm" fontWeight="600" color="text.primary">{unitName(u.unit)}</Td>
                      <Td fontSize="sm" color="text.secondary">{u.resource_name}</Td>
                      <Td isNumeric fontSize="sm">{u.rented_days.toFixed(1)} / {Math.round(u.period_days)}</Td>
                      <Td>
                        <Flex align="center" gap="10px">
                          <Progress value={u.utilization * 100} size="sm" borderRadius="4px" flex="1" colorScheme="brandScheme" aria-label={`Pemakaian ${unitName(u.unit)}`} />
                          <Text fontSize="sm" w="44px" textAlign="right">{Math.round(u.utilization * 100)}%</Text>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>

          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="20px">
            <Card p="20px">
              <Text fontWeight="700" color="text.primary" mb="4px">Menganggur lebih dari 30 hari</Text>
              <Text fontSize="xs" color="text.secondary" mb="12px">Unit aktif yang tidak keluar sebulan terakhir. Tidak bergantung pada periode.</Text>
              {idle.isPending && <Spinner color="brand.500" />}
              {idle.data?.length === 0 && <Text fontSize="sm" color="text.secondary">Semua unit terpakai dalam 30 hari terakhir.</Text>}
              {idle.data?.map((u) => (
                <Flex key={u.unit.id} justify="space-between" py="8px" borderTop="1px solid" borderColor="border.subtle" gap="12px" wrap="wrap">
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="text.primary">{unitName(u.unit)}</Text>
                    <Text fontSize="xs" color="text.secondary">{u.resource_name}</Text>
                  </Box>
                  <Text fontSize="xs" color="text.secondary" alignSelf="center">
                    {u.last_rented_at ? `Terakhir disewa ${formatDateTime(u.last_rented_at)}` : 'Belum pernah disewa'} · {u.idle_days} hari
                  </Text>
                </Flex>
              ))}
            </Card>
            <Card p="20px">
              <Text fontWeight="700" color="text.primary" mb="4px">Sedang terlambat</Text>
              <Text fontSize="xs" color="text.secondary" mb="12px">Masih di penyewa dan lewat jadwal kembali.</Text>
              {late.isPending && <Spinner color="brand.500" />}
              {late.data?.length === 0 && <Text fontSize="sm" color="text.secondary">Tidak ada yang terlambat.</Text>}
              {late.data?.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`}>
                  <Flex justify="space-between" py="8px" borderTop="1px solid" borderColor="border.subtle" gap="12px" wrap="wrap" _hover={{ bg: 'surface.hover' }}>
                    <Text fontSize="sm" fontWeight="600" color="text.primary">{b.code} · {b.customer.name}</Text>
                    <Text fontSize="xs" color="text.secondary" alignSelf="center">Seharusnya {formatDateTime(b.end_at)}</Text>
                  </Flex>
                </Link>
              ))}
            </Card>
          </SimpleGrid>
        </>
      )}
    </PageShell>
  )
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Flex justify="space-between" py="6px" borderTop={strong ? '1px solid' : undefined} borderColor="border.subtle" mt={strong ? '6px' : 0}>
      <Text fontSize="sm" color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? '700' : '400'}>{label}</Text>
      <Text fontSize="sm" color="text.primary" fontWeight={strong ? '700' : '500'}>{formatRupiah(value)}</Text>
    </Flex>
  )
}

const REPORTS: { value: ExportRequest['report']; label: string }[] = [
  { value: 'revenue', label: 'Pemasukan & deposit' },
  { value: 'utilization', label: 'Pemakaian unit' },
  { value: 'idle_units', label: 'Unit menganggur' },
  { value: 'bookings', label: 'Booking terlambat' },
]

/**
 * Export: queued, then polled. The link is signed for 15 minutes each time
 * the job is read (BR-077), so "Perbarui tautan" is just asking again.
 */
function ExportCard({ period }: { period: { from: string; to: string } }) {
  const [report, setReport] = useState<ExportRequest['report']>('revenue')
  const [format, setFormat] = useState<ExportRequest['format']>('xlsx')
  const [jobId, setJobId] = useState<string | null>(null)

  const start = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/reports/export', { body: { report, format, ...period } })
      if (error) throw error
      return data.job_id
    },
    onSuccess: setJobId,
  })
  const job = useQuery({
    queryKey: ['job', jobId],
    enabled: jobId !== null,
    queryFn: async () => {
      const { data, error } = await api.GET('/jobs/{id}', { params: { path: { id: jobId ?? '' } } })
      if (error) throw error
      return data
    },
    refetchInterval: (q) => (q.state.data?.status === 'done' || q.state.data?.status === 'failed' ? false : 2000),
  })
  const status = job.data?.status
  const working = start.isPending || (jobId !== null && status !== 'done' && status !== 'failed')

  return (
    <Card variant="section" mb="20px">
      <Text fontWeight="700" color="text.primary" mb="4px">Ekspor</Text>
      <Text fontSize="xs" color="text.secondary" mb="16px">
        File dibuat di latar — kamu boleh tetap memakai layar ini. Periode mengikuti pilihan di atas.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="0 20px" alignItems="end">
        <SelectField label="Laporan" value={report} onChange={(v) => setReport(v as ExportRequest['report'])} options={REPORTS} />
        <SelectField label="Format" value={format} onChange={(v) => setFormat(v as ExportRequest['format'])}
          options={[{ value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV' }]} />
        <Button variant="brand" mb="20px" isLoading={working} loadingText="Menyiapkan file…"
          onClick={() => { setJobId(null); start.mutate() }}>Buat file</Button>
      </SimpleGrid>
      <Box role="status" aria-live="polite">
        {start.error && <Text fontSize="sm" color="red.500">File tidak bisa dibuat. Periksa periodenya lalu coba lagi.</Text>}
        {status === 'failed' && <Text fontSize="sm" color="red.500">{job.data?.error ?? 'File gagal dibuat.'} Coba sekali lagi.</Text>}
        {status === 'done' && job.data?.download_url && (
          <Flex align="center" gap="12px" wrap="wrap">
            <Button as="a" href={job.data.download_url} size="sm" variant="outline">Unduh file</Button>
            <Text fontSize="xs" color="text.secondary">
              Tautan berlaku sampai {job.data.expires_at ? formatDateTime(job.data.expires_at) : '15 menit'}.
            </Text>
            <Button size="sm" variant="link" onClick={() => void job.refetch()}>Perbarui tautan</Button>
          </Flex>
        )}
      </Box>
    </Card>
  )
}

