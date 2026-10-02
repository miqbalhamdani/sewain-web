'use client'

import { Badge, Box, Flex, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'

import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

const STATUS: Record<string, { label: string; scheme: string }> = {
  unpaid: { label: 'belum bayar', scheme: 'orange' },
  gateway_pending: { label: 'menunggu', scheme: 'gray' },
  paid: { label: 'lunas', scheme: 'green' },
  overdue: { label: 'lewat tenggat', scheme: 'red' },
  cancelled: { label: 'batal', scheme: 'gray' },
}

/**
 * Invoice booking ini.  (S1-041)
 *
 * Amounts follow the same rule as price on this screen: not rendered for an
 * operator (BR-003). The operator still sees that an invoice exists and its
 * status -- pay-before-pickup depends on it.
 */
export function InvoiceSummary({ bookingId }: { bookingId: string }) {
  const canSeeMoney = useCan('pricing:write')
  const { data } = useQuery({
    queryKey: ['bookings', bookingId, 'invoices'],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices', { params: { query: { booking_id: bookingId } } })
      if (error) throw error
      return data
    },
  })
  if (!data || data.length === 0) return null

  return (
    <Box mt="24px">
      <Text fontWeight="700" color="text.primary" mb="8px">Tagihan</Text>
      {data.map((inv) => (
        <Box key={inv.id} borderWidth="1px" borderColor="border.subtle" borderRadius="12px" p="12px" mb="8px">
          <Flex justify="space-between" align="center" mb="6px">
            <Text fontSize="sm" fontWeight="600" color="text.primary">{inv.number}</Text>
            <Badge colorScheme={STATUS[inv.status]?.scheme ?? 'gray'}>{STATUS[inv.status]?.label ?? inv.status}</Badge>
          </Flex>
          {canSeeMoney && inv.lines.map((l) => (
            <Flex key={l.id} justify="space-between" fontSize="sm" color="text.secondary">
              <Text>{l.description}</Text>
              <Text>{formatRupiah(l.amount)}</Text>
            </Flex>
          ))}
          <Flex justify="space-between" fontSize="sm" mt="6px">
            <Text color="text.secondary">Tenggat {formatDateTime(inv.due_at)}</Text>
            {canSeeMoney && <Text fontWeight="700" color="text.primary">{formatRupiah(inv.total)}</Text>}
          </Flex>
        </Box>
      ))}
    </Box>
  )
}
