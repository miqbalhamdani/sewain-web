'use client'

import { Badge, Button, Card, Flex, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { SelectField } from 'components/fields/SelectField'
import { INVOICE_STATUS } from 'components/invoice/status'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type InvoiceStatus = components['schemas']['InvoiceStatus']

/**
 * Tagihan -- every invoice across bookings, owner only.  (S1-047, BR-003)
 *
 * Paged on the server, so the status filter is the server's too. Totals are
 * the server's SUM(lines), in full rupiah. Paying happens on the booking, where
 * the context is.
 */
export default function InvoicesPage() {
  const [status, setStatus] = useState('')
  const query = useInfiniteQuery({
    queryKey: ['invoices', 'all', status],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET('/invoices', {
        params: { query: { ...(status !== '' ? { status: status as InvoiceStatus } : {}),
          ...(pageParam ? { cursor: pageParam } : {}) } },
      })
      if (error) throw error
      return data
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  const rows = query.data?.pages.flatMap((p) => p.data) ?? []

  return (
    <PageShell title="Tagihan" subtitle="Semua invoice, terbaru di atas. Pembayaran dicatat dari booking-nya.">
      <Card variant="section" mb="20px">
        <SelectField label="Status" value={status} onChange={setStatus}
          options={[{ value: '', label: 'Semua status' },
            ...Object.entries(INVOICE_STATUS).filter(([v]) => v !== 'gateway_pending')
              .map(([value, s]) => ({ value, label: s.label }))]} />
      </Card>
      {query.isPending && <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" /></Flex>}
      {!query.isPending && rows.length === 0 && status === '' && (
        <EmptyState title="Belum ada tagihan" description="Invoice terbit sendiri saat booking dibuat — mulai dari booking pertama."
          action={<Flex justify="center"><Button as={Link} href="/bookings/new" variant="brand">Buat booking</Button></Flex>} />
      )}
      {!query.isPending && (rows.length > 0 || status !== '') && (
        <Card variant="table">
          <Table variant="simple" minW="640px">
            <Thead><Tr><Th>Nomor</Th><Th>Status</Th><Th>Tenggat / lunas</Th><Th isNumeric>Total</Th></Tr></Thead>
            <Tbody>
              {rows.map((inv) => {
                const s = INVOICE_STATUS[inv.status] ?? { label: inv.status, scheme: 'gray' }
                return (
                  <Tr key={inv.id} _hover={{ bg: 'surface.hover' }}>
                    <Td><Link href={`/bookings?id=${inv.booking_id}`}><Text fontWeight="600" color="text.primary" whiteSpace="nowrap">{inv.number}</Text></Link></Td>
                    <Td><Badge colorScheme={s.scheme}>{s.label}</Badge></Td>
                    <Td fontSize="sm" color="text.secondary">{inv.paid_at ? `Lunas ${formatDateTime(inv.paid_at)}` : formatDateTime(inv.due_at)}</Td>
                    <Td isNumeric fontWeight="600" color="text.primary">{formatRupiah(inv.total)}</Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
          {rows.length === 0 && <Text fontSize="sm" color="text.secondary" textAlign="center" py="40px">Tidak ada invoice dengan status ini.</Text>}
          {query.hasNextPage && (
            <Flex justify="center" py="16px">
              <Button size="sm" variant="outline" isLoading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Muat lebih banyak</Button>
            </Flex>
          )}
        </Card>
      )}
    </PageShell>
  )
}
