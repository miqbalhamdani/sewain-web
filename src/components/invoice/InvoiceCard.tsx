'use client'

import { Badge, Box, Button, Flex, Text } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ConfirmDialog } from 'components/table/ConfirmDialog'
import { useCan } from 'contexts/SessionContext'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

import { ProofSection } from './ProofSection'
import { INVOICE_STATUS } from './status'

type Invoice = components['schemas']['Invoice']

/**
 * One invoice with its lines.  (S1-047)
 *
 * The total is the server's -- SUM(lines), never added up here (BR-055) -- and
 * money is full rupiah: 350000 renders Rp 350.000.
 *
 * Amounts show to every role. BR-003 hides prices, deposits and revenue from
 * an operator, but it also gives the operator "mencatat pembayaran": the person
 * collecting the cash has to see the bill.
 */
export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient()
  const canPay = useCan('payments:write')
  const [method, setMethod] = useState<'cash' | 'manual_transfer' | null>(null)
  const [error, setError] = useState('')
  const status = INVOICE_STATUS[invoice.status] ?? { label: invoice.status, scheme: 'gray' }
  const payable = (invoice.status === 'unpaid' || invoice.status === 'overdue') && invoice.total > 0

  const bayar = useMutation({
    retry: false,
    mutationFn: async (m: 'cash' | 'manual_transfer') => {
      const { error } = await api.POST('/invoices/{id}/payments', {
        // One key per click: the confirm dialog is the intent (BR-090).
        params: { path: { id: invoice.id }, header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: { method: m, amount: invoice.total },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setMethod(null)
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (problem) => {
      setMethod(null)
      setError(problemCode(problem) === 'invoice-already-paid'
        ? 'Invoice ini sudah lunas — mungkin baru dicatat orang lain.'
        : 'Pembayaran gagal dicatat. Coba lagi.')
    },
  })

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="12px" p="12px" mb="8px"
      opacity={invoice.status === 'cancelled' ? 0.6 : 1}>
      <Flex justify="space-between" align="center" mb="6px">
        <Text fontSize="sm" fontWeight="600" color="text.primary">{invoice.number}</Text>
        <Badge colorScheme={status.scheme}>{status.label}</Badge>
      </Flex>
      {invoice.lines.map((l) => (
        <Flex key={l.id} justify="space-between" fontSize="sm" color="text.secondary" gap="12px">
          <Text>{l.description}</Text>
          <Text whiteSpace="nowrap">{formatRupiah(l.amount)}</Text>
        </Flex>
      ))}
      {invoice.status === 'cancelled' && (
        <Text fontSize="xs" color="text.secondary" mt="4px">Dibatalkan — sudah diserap deposit, atau tidak berlaku lagi.</Text>
      )}
      <Flex justify="space-between" fontSize="sm" mt="6px">
        <Text color="text.secondary">
          {invoice.paid_at ? `Lunas ${formatDateTime(invoice.paid_at)}` : `Tenggat ${formatDateTime(invoice.due_at)}`}
        </Text>
        <Text fontWeight="700" color="text.primary">{formatRupiah(invoice.total)}</Text>
      </Flex>

      {error !== '' && <Text role="alert" fontSize="sm" color="red.500" mt="6px">{error}</Text>}
      {canPay && payable && (
        <Flex gap="8px" mt="10px" wrap="wrap">
          <Button size="sm" variant="outline" onClick={() => { setError(''); setMethod('cash') }}>Catat tunai</Button>
          <Button size="sm" variant="outline" onClick={() => { setError(''); setMethod('manual_transfer') }}>Catat transfer</Button>
        </Flex>
      )}
      {invoice.status !== 'cancelled' && <ProofSection invoice={invoice} />}

      <ConfirmDialog
        isOpen={method !== null}
        title={`Catat ${invoice.number} lunas?`}
        body={`${method === 'cash' ? 'Tunai' : 'Transfer yang sudah kamu cek di rekening'} sebesar ${formatRupiah(invoice.total)}. Lunas penuh — tidak ada pembayaran sebagian.`}
        busy={bayar.isPending}
        onCancel={() => setMethod(null)}
        onConfirm={() => method && bayar.mutate(method)}
      />
    </Box>
  )
}
