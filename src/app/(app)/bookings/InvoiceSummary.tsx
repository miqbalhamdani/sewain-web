'use client'

import { Box, Text } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'

import { InvoiceCard } from 'components/invoice/InvoiceCard'
import { api } from 'lib/api/client'

/** Tagihan booking ini, satu kartu per invoice.  (S1-041, S1-047) */
export function InvoiceSummary({ bookingId }: { bookingId: string }) {
  const { data } = useQuery({
    queryKey: ['bookings', bookingId, 'invoices'],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices', { params: { query: { booking_id: bookingId } } })
      if (error) throw error
      return data.data
    },
  })
  if (!data || data.length === 0) return null
  return (
    <Box mt="24px">
      <Text fontWeight="700" color="text.primary" mb="8px">Tagihan</Text>
      {data.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)}
    </Box>
  )
}
