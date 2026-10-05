'use client'

import { CheckCircleIcon, WarningTwoIcon } from '@chakra-ui/icons'
import { Badge, Box, Button, Card, CloseButton, Flex, SimpleGrid, Spinner, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { useSession } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDayTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type Brief = components['schemas']['BookingBrief']

const ONBOARDING_KEY = 'sewain.onboarding.dismissed'

/**
 * Dashboard -- what needs handling today.  (S1-063, BR-003, BR-005)
 *
 * Warnings first: bookings out past their end, then deposits still held after
 * return. Money (this month's revenue) and failed background jobs are the
 * owner's; for an operator the API sends them as null and nothing is drawn.
 */
export default function Dashboard() {
  const { user } = useSession()
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data, error } = await api.GET('/dashboard')
      if (error) throw error
      return data
    },
    refetchInterval: 60_000,
  })
  const d = query.data

  return (
    <PageShell title="Dashboard" subtitle={`Masuk sebagai ${user?.name ?? ''} · ${user?.role === 'owner' ? 'Pemilik' : 'Operator'}`}>
      {query.isPending && <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" thickness="3px" /></Flex>}
      {query.error !== null && !query.isPending && (
        <Card variant="panel" role="alert"><Text color="text.primary">Dashboard gagal dimuat. Muat ulang halaman ini.</Text></Card>
      )}
      {d && (
        <>
          <Onboarding steps={d.onboarding} />

          <SimpleGrid columns={{ base: 1, md: d.revenue_this_month !== null ? 3 : 2 }} gap="20px" mb="20px">
            {d.revenue_this_month !== null && (
              <Stat label="Pendapatan bulan ini" value={formatRupiah(d.revenue_this_month)} hint="Uang yang sudah masuk. Deposit tidak dihitung." />
            )}
            <Stat label="Tagihan belum dibayar" value={formatRupiah(d.invoices.outstanding)}
              hint={`${d.invoices.unpaid_count} menunggu · ${d.invoices.overdue_count} lewat tenggat`} />
            <Stat label="Sedang terlambat" value={String(d.overdue.length)}
              hint={d.overdue.length === 0 ? 'Semua unit kembali tepat waktu.' : 'Hubungi penyewanya hari ini.'} />
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="20px" mb="20px">
            <BriefList title="Terlambat kembali" tone="warning" rows={d.overdue} when={(b) => `Seharusnya kembali ${formatDayTime(b.end_at)}`}
              empty="Tidak ada yang terlambat." />
            <BriefList title="Deposit belum diselesaikan" tone="warning" rows={d.unsettled_deposits}
              when={(b) => `Kembali ${formatDayTime(b.end_at)}`} empty="Semua deposit sudah diselesaikan." />
            <BriefList title="Diambil hari ini" rows={d.today_pickups} when={(b) => formatDayTime(b.start_at)} empty="Tidak ada pengambilan hari ini." />
            <BriefList title="Kembali hari ini" rows={d.today_returns} when={(b) => formatDayTime(b.end_at)} empty="Tidak ada pengembalian hari ini." />
          </SimpleGrid>

          {d.failed_jobs !== null && d.failed_jobs.length > 0 && (
            <Card variant="panel" role="alert">
              <Text fontWeight="700" color="text.primary" mb="4px">Pekerjaan latar yang gagal</Text>
              <Text fontSize="sm" color="text.secondary" mb="12px">Sudah dicoba ulang beberapa kali. Kalau ekspor, minta ulang dari Laporan.</Text>
              {d.failed_jobs.map((j, i) => (
                <Flex key={i} justify="space-between" gap="12px" py="8px" borderTop="1px solid" borderColor="border.subtle" wrap="wrap">
                  <Text fontSize="sm" color="text.primary">{JOB_LABEL[j.type] ?? j.type} — {j.error}</Text>
                  <Text fontSize="xs" color="text.secondary">{formatDayTime(j.failed_at)} · percobaan ke-{j.attempt}</Text>
                </Flex>
              ))}
            </Card>
          )}
        </>
      )}
    </PageShell>
  )
}

const JOB_LABEL: Record<string, string> = {
  'report.export': 'Ekspor laporan',
  'proof.scan': 'Baca bukti transfer',
  'expiry.sweep': 'Kedaluwarsa otomatis',
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card p="20px">
      <Text fontSize="sm" color="text.secondary">{label}</Text>
      <Text fontSize="2xl" fontWeight="700" color="text.primary">{value}</Text>
      <Text fontSize="xs" color="text.secondary">{hint}</Text>
    </Card>
  )
}

function BriefList({ title, rows, when, empty, tone }: {
  title: string; rows: Brief[]; when: (b: Brief) => string; empty: string; tone?: 'warning'
}) {
  const warn = tone === 'warning' && rows.length > 0
  return (
    <Card p="20px" borderLeft={warn ? '4px solid' : undefined} borderColor={warn ? 'orange.400' : undefined}>
      <Flex align="center" gap="8px" mb="8px">
        {warn && <WarningTwoIcon color="orange.400" />}
        <Text fontWeight="700" color="text.primary">{title}</Text>
        {rows.length > 0 && <Badge colorScheme={warn ? 'orange' : 'gray'}>{rows.length}</Badge>}
      </Flex>
      {rows.length === 0 && <Text fontSize="sm" color="text.secondary">{empty}</Text>}
      {rows.map((b) => (
        <Link key={b.id} href={`/bookings/${b.id}`}>
          <Flex justify="space-between" gap="12px" py="8px" borderTop="1px solid" borderColor="border.subtle" _hover={{ bg: 'surface.hover' }} wrap="wrap">
            <Box>
              <Text fontSize="sm" fontWeight="600" color="text.primary">{b.code} · {b.customer_name}</Text>
              <Text fontSize="xs" color="text.secondary">{b.resource_name} · {b.unit.label ? `${b.unit.code} (${b.unit.label})` : b.unit.code}</Text>
            </Box>
            <Text fontSize="xs" color="text.secondary" alignSelf="center">{when(b)}</Text>
          </Flex>
        </Link>
      ))}
    </Card>
  )
}

/**
 * The first-steps checklist, computed from data (BR-005): never a blocker,
 * dismissible, and gone for good once all three are done. Dismissal is a
 * per-browser convenience, so it lives in localStorage and survives without it.
 */
function Onboarding({ steps }: { steps: components['schemas']['Dashboard']['onboarding'] }) {
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    try { setDismissed(localStorage.getItem(ONBOARDING_KEY) === '1') } catch { setDismissed(false) }
  }, [])
  const done = steps.has_resource && steps.has_unit && steps.has_booking
  if (done || dismissed) return null

  const items = [
    { ok: steps.has_resource, label: 'Tambah barang yang disewakan', href: '/catalog/new' },
    { ok: steps.has_unit, label: 'Tambah unit fisiknya (plat nomor / nomor seri)', href: '/catalog' },
    { ok: steps.has_booking, label: 'Buat booking pertama', href: '/bookings/new' },
  ]
  const next = items.find((i) => !i.ok)
  return (
    <Box mb="20px">
      <EmptyState
        title="Langkah pertama"
        description="Tiga langkah sampai booking pertama. Boleh dilewati — daftar ini hilang sendiri setelah selesai."
        action={
          <>
            {items.map((i) => (
              <Flex key={i.label} align="center" gap="10px" mb="8px">
                <CheckCircleIcon color={i.ok ? 'green.400' : 'gray.300'} />
                <Text fontSize="sm" color={i.ok ? 'text.secondary' : 'text.primary'} textDecoration={i.ok ? 'line-through' : undefined}>{i.label}</Text>
              </Flex>
            ))}
            <Flex gap="12px" mt="12px" align="center">
              {next && <Button as={Link} href={next.href} variant="brand" size="sm">{next.label}</Button>}
              <CloseButton size="sm" aria-label="Sembunyikan langkah pertama" ms="auto"
                onClick={() => { setDismissed(true); try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* tetap tersembunyi sampai muat ulang */ } }} />
            </Flex>
          </>
        }
      />
    </Box>
  )
}
