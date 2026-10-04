'use client'

import { Badge, Box, Button, Flex, Text } from '@chakra-ui/react'
import { useId, useState } from 'react'

import { useCan } from 'contexts/SessionContext'
import { useDialogState } from 'hooks/useDialogState'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

import { ProofSection } from './ProofSection'
import { RecordPaymentDialog } from './RecordPaymentDialog'
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
 *
 * Satu aksi per invoice yang belum lunas: "Catat pembayaran", yang membuka
 * RecordPaymentDialog. Cara bayar dan bukti ditanyakan di sana, bukan sebagai
 * tiga tombol berdampingan di kartu ini.
 *
 * `collapsible`: an invoice that is paid or cancelled opens folded -- one line
 * with number, status and total, and a "Lihat rincian" button. What still
 * needs paying is never folded; hiding the bill behind a click is how it gets
 * missed.
 */
export function InvoiceCard({
  invoice,
  collapsible = false,
  primary = false,
  reviewPrimary = false,
  absorbedByDeposit = false,
  pendingProofs = 0,
}: {
  invoice: Invoice
  collapsible?: boolean
  /** Tombol bayar tampil ungu hanya kalau kartu langkah menunjuk ke sini. */
  primary?: boolean
  /** Diteruskan ke ProofSection: Setujui tampil ungu kalau langkahnya meninjau bukti. */
  reviewPrimary?: boolean
  /** Tagihan denda/kerusakan yang akan diserap deposit (BR-048): tanpa tombol bayar. */
  absorbedByDeposit?: boolean
  /** Bukti penyewa yang masih menunggu di invoice ini. */
  pendingProofs?: number
}) {
  const canPay = useCan('payments:write')
  const rincianId = useId()
  const bayar = useDialogState<true>()
  const status = INVOICE_STATUS[invoice.status] ?? { label: invoice.status, scheme: 'gray' }
  const payable = (invoice.status === 'unpaid' || invoice.status === 'overdue') && invoice.total > 0
  const beres = invoice.status === 'paid' || invoice.status === 'cancelled'
  const bisaDilipat = collapsible && beres
  const [terbuka, setTerbuka] = useState(!bisaDilipat)

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="12px" p="12px" mb="8px"
      opacity={invoice.status === 'cancelled' ? 0.7 : 1}>
      <Flex justify="space-between" align="center" gap="8px" wrap="wrap" mb={terbuka ? '6px' : '0'}>
        <Flex align="center" gap="8px" wrap="wrap">
          <Text fontWeight="600" color="text.primary">{invoice.number}</Text>
          <Badge colorScheme={status.scheme}>{status.label}</Badge>
        </Flex>
        <Flex align="center" gap="12px">
          {!terbuka && <Text fontWeight="700" color="text.primary">{formatRupiah(invoice.total)}</Text>}
          {bisaDilipat && (
            <Button size="sm" variant="outline" aria-expanded={terbuka} aria-controls={rincianId}
              onClick={() => setTerbuka((v) => !v)}>
              {terbuka ? 'Sembunyikan' : 'Lihat rincian'}
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Selalu dirender supaya aria-controls di atas menunjuk id yang ada;
          `hidden` yang menyembunyikannya. */}
      <Box id={rincianId} hidden={!terbuka}>
        {invoice.lines.map((l) => (
          <Flex key={l.id} justify="space-between" color="text.secondary" gap="12px">
            <Text>{l.description}</Text>
            <Text whiteSpace="nowrap">{formatRupiah(l.amount)}</Text>
          </Flex>
        ))}
        {invoice.status === 'cancelled' && (
          <Text fontSize="sm" color="text.secondary" mt="4px">Dibatalkan — sudah diserap deposit, atau tidak berlaku lagi.</Text>
        )}
        <Flex justify="space-between" mt="6px" gap="12px" wrap="wrap">
          <Text color="text.secondary">
            {invoice.paid_at ? `Lunas ${formatDateTime(invoice.paid_at)}` : `Tenggat ${formatDateTime(invoice.due_at)}`}
          </Text>
          <Text fontWeight="700" color="text.primary">{formatRupiah(invoice.total)}</Text>
        </Flex>

        {canPay && payable && absorbedByDeposit && (
          <Text fontSize="sm" color="text.secondary" mt="10px">
            Ditagih lewat deposit. Tekan &ldquo;Selesaikan deposit&rdquo; di bawah — tagihan ini ditutup, dan
            kekurangannya terbit sebagai tagihan baru.
          </Text>
        )}
        {canPay && payable && !absorbedByDeposit && (
          <>
            {pendingProofs > 0 && (
              <Text fontSize="sm" color="text.secondary" mt="10px">
                Ada bukti transfer dari penyewa yang menunggu ditinjau di bawah. Periksa itu dulu; catat
                pembayaran hanya kalau penyewa membayar dengan cara lain.
              </Text>
            )}
            <Button size="sm" variant={primary ? 'brand' : 'outline'} mt={pendingProofs > 0 ? '8px' : '12px'}
              onClick={() => bayar.open(true)}>
              Catat pembayaran
            </Button>
          </>
        )}
        {invoice.status !== 'cancelled' && <ProofSection invoice={invoice} primary={reviewPrimary} />}
      </Box>

      {bayar.value && (
        <RecordPaymentDialog invoice={invoice} isOpen={bayar.isOpen} onClose={bayar.close} onCloseComplete={bayar.onCloseComplete} />
      )}
    </Box>
  )
}
