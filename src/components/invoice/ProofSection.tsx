'use client'

import { Badge, Box, Button, Flex, Input, Link, Text } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useCan } from 'contexts/SessionContext'
import { usePhotoUpload } from 'hooks/usePhotoUpload'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'
import { formatRupiah } from 'lib/format/money'

type Invoice = components['schemas']['Invoice']
type Proof = components['schemas']['PaymentProof']

const BACAAN: Record<string, { label: string; scheme: string }> = {
  match: { label: 'rekomendasi: cocok', scheme: 'green' },
  mismatch: { label: 'rekomendasi: tidak cocok', scheme: 'orange' },
  unreadable: { label: 'rekomendasi: tak terbaca', scheme: 'gray' },
}

/**
 * Transfer proofs of one invoice.  (S1-049, BR-062)
 *
 * The automatic reading is shown as a RECOMMENDATION, never as a status --
 * and in phase 1 there is no reader, so every proof says "check by hand". Only
 * a person pressing Setujui makes the invoice paid.
 */
export function ProofSection({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient()
  const canPay = useCan('payments:write')
  const input = useRef<HTMLInputElement>(null)
  const upload = usePhotoUpload('payment_proof')
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const { data: proofs } = useQuery({
    queryKey: ['invoices', invoice.id, 'proofs'],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices/{id}/proofs', { params: { path: { id: invoice.id } } })
      if (error) throw error
      return data
    },
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['invoices'] })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }

  const kirim = useMutation({
    retry: false,
    mutationFn: async (key: string) => {
      const { error } = await api.POST('/invoices/{id}/proofs', { params: { path: { id: invoice.id } }, body: { object_key: key } })
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (p) => setError(problemCode(p) === 'invoice-already-paid' ? 'Invoice ini sudah lunas.' : 'Bukti gagal disimpan. Unggah ulang.'),
  })
  // Commit each upload as soon as its PUT finishes.
  const done = upload.photos.filter((p) => p.status === 'done').map((p) => p.key!)
  const sent = useRef(new Set<string>())
  useEffect(() => {
    for (const key of done) {
      if (!sent.current.has(key)) {
        sent.current.add(key)
        kirim.mutate(key)
      }
    }
  }, [done.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const putus = useMutation({
    retry: false,
    mutationFn: async ({ proof, approve }: { proof: Proof; approve: boolean }) => {
      const { error } = approve
        ? await api.POST('/proofs/{id}/approve', {
          params: { path: { id: proof.id }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
        : await api.POST('/proofs/{id}/reject', { params: { path: { id: proof.id } }, body: { reason: reason.trim() } })
      if (error) throw error
    },
    onSuccess: () => { setRejecting(null); setReason(''); refresh() },
    onError: (p) => setError(problemCode(p) === 'invoice-already-paid' ? 'Invoice ini sudah lunas.' : 'Keputusan gagal disimpan.'),
  })

  const open = invoice.status === 'unpaid' || invoice.status === 'overdue'
  if (!open && (proofs?.length ?? 0) === 0) return null

  return (
    <Box mt="12px" pt="10px" borderTopWidth="1px" borderColor="border.subtle">
      <Flex justify="space-between" align="center" mb="6px">
        <Text fontSize="sm" fontWeight="600" color="text.primary">Bukti transfer</Text>
        {canPay && open && (
          <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden
              onChange={(e) => { setError(''); if (e.target.files) upload.add(e.target.files); e.target.value = '' }} />
            <Button size="xs" variant="outline" isLoading={upload.pending || kirim.isPending}
              onClick={() => input.current?.click()}>Unggah bukti</Button>
          </>
        )}
      </Flex>
      {proofs?.map((p) => (
        <Box key={p.id} fontSize="sm" py="6px">
          <Flex justify="space-between" align="center" gap="8px" wrap="wrap">
            <Link href={p.url} isExternal color="brand.500">
              {p.content_type === 'application/pdf' ? 'PDF' : 'Gambar'} · {formatDateTime(p.created_at)}
            </Link>
            {p.review_status === 'pending' ? (
              p.match_status
                ? <Badge colorScheme={BACAAN[p.match_status].scheme}>{BACAAN[p.match_status].label}</Badge>
                : <Badge colorScheme="gray">belum dibaca otomatis — periksa manual</Badge>
            ) : (
              <Badge colorScheme={p.review_status === 'approved' ? 'green' : 'red'}>
                {p.review_status === 'approved' ? 'disetujui' : 'ditolak'}
              </Badge>
            )}
          </Flex>
          {p.ai_amount !== null && (
            <Text fontSize="xs" color="text.secondary">Terbaca: {formatRupiah(p.ai_amount)} — cocokkan sendiri sebelum menyetujui.</Text>
          )}
          {p.review_status === 'rejected' && <Text fontSize="xs" color="text.secondary">Alasan: {p.reject_reason}</Text>}
          {canPay && open && p.review_status === 'pending' && rejecting !== p.id && (
            <Flex gap="8px" mt="6px">
              <Button size="xs" variant="brand" isLoading={putus.isPending}
                onClick={() => putus.mutate({ proof: p, approve: true })}>Setujui — lunas</Button>
              <Button size="xs" variant="outline" onClick={() => setRejecting(p.id)}>Tolak</Button>
            </Flex>
          )}
          {rejecting === p.id && (
            <Flex gap="8px" mt="6px">
              <Input size="sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan, mis. nominal kurang" />
              <Button size="sm" variant="outline" colorScheme="red" isDisabled={reason.trim() === ''}
                isLoading={putus.isPending} onClick={() => putus.mutate({ proof: p, approve: false })}>Tolak</Button>
            </Flex>
          )}
        </Box>
      ))}
      {error !== '' && <Text role="alert" fontSize="xs" color="red.500">{error}</Text>}
    </Box>
  )
}
