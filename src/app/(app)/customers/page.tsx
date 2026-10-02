'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  Flex,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Switch,
  Tooltip,
  Tr,
} from '@chakra-ui/react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Suspense, useDeferredValue, useEffect, useState } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { TableSearch } from 'components/table/TableSearch'
import { useCan } from 'contexts/SessionContext'
import { useDialogState } from 'hooks/useDialogState'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'

import { ID_TYPES } from './CustomerDialog'

type Customer = components['schemas']['Customer']

const CustomerDialog = dynamic(() => import('./CustomerDialog'))
const BlacklistDialog = dynamic(() => import('./BlacklistDialog'))

const JENIS: Record<string, string> = Object.fromEntries(ID_TYPES.map((t) => [t.value, t.label]))

/**
 * Penyewa.  (S1-031)
 *
 * Daftarnya berhalaman (cursor), jadi pencarian dikirim ke server sebagai `q`
 * -- mencari di klien hanya akan mencari di halaman yang kebetulan termuat
 * (lihat catatan di FilterCard). Blokir/buka hanya dirender untuk `owner`
 * (BR-028); operator tetap melihat statusnya beserta alasan.
 */
export default function CustomersPage() {
  const canWrite = useCan('customers:write')
  const canBlacklist = useCan('customers:blacklist')
  const [cari, setCari] = useState('')
  const q = useDeferredValue(cari.trim())
  const ubah = useDialogState<{ customer: Customer | null }>()
  const blokir = useDialogState<Customer>()
  // Kode dialog diunduh sesudah daftar tampil, bukan saat klik pertama.
  useEffect(() => {
    void import('./CustomerDialog')
    void import('./BlacklistDialog')
  }, [])
  const [status, setStatus] = useState<'' | 'aktif' | 'diblokir'>('')

  const query = useInfiniteQuery({
    queryKey: ['customers', q, status],
    // Ganti tab tidak mengosongkan tabel jadi spinner; baris lama tampil sampai yang baru tiba.
    placeholderData: keepPreviousData,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET('/customers', {
        params: { query: {
          ...(q !== '' ? { q } : {}),
          ...(status !== '' ? { blacklisted: status === 'diblokir' } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
        } },
      })
      if (error) throw error
      return data
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  const rows = query.data?.pages.flatMap((p) => p.data) ?? []
  const kosongTotal = !query.isPending && rows.length === 0 && q === '' && status === ''
  const kosongSaring = status === 'diblokir' ? 'Tidak ada penyewa yang diblokir.'
    : status === 'aktif' ? 'Tidak ada penyewa aktif yang cocok.'
    : 'Tidak ada penyewa dengan nama atau telepon itu.'

  const tab = (
    <ButtonGroup size="sm" isAttached variant="outline" role="group" aria-label="Saring status blokir">
      {([['', 'Semua'], ['aktif', 'Aktif'], ['diblokir', 'Diblokir']] as const).map(([v, label]) => (
        <Button key={v} onClick={() => setStatus(v)} aria-pressed={status === v} h="36px" px="14px"
          {...(status === v ? { variant: 'brand', zIndex: 1 } : { color: 'text.secondary' })}>
          {label}
        </Button>
      ))}
    </ButtonGroup>
  )

  const tambah = canWrite && (
    <Button variant="brand" leftIcon={<AddIcon />} onClick={() => ubah.open({ customer: null })}>
      Tambah penyewa
    </Button>
  )

  return (
    <PageShell title="Penyewa" subtitle="Orang yang menyewa dari kamu, beserta status blokirnya." action={!kosongTotal && tambah}>
      {query.isPending && (
        <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" thickness="3px" /></Flex>
      )}
      {query.error !== null && !query.isPending && (
        <Card variant="panel" role="alert"><Text color="text.primary">Daftar penyewa gagal dimuat. Muat ulang halaman ini.</Text></Card>
      )}

      {kosongTotal && (
        <EmptyState
          title="Belum ada penyewa"
          description="Catat penyewa pertamamu — nama dan nomor WhatsApp cukup untuk mulai membuat booking."
          action={tambah && <Flex justify="center">{tambah}</Flex>}
        />
      )}

      {!query.isPending && !kosongTotal && (
        <Card variant="table">
          <TableSearch value={cari} onChange={setCari} placeholder="Cari nama atau telepon"
            resultCount={rows.length} totalCount={rows.length} leading={tab} />
          <Table variant="simple" minW="720px">
            <Thead>
              <Tr>
                <Th>Nama</Th>
                <Th>Telepon</Th>
                <Th>Identitas</Th>
                <Th>{canBlacklist ? 'Diblokir' : 'Status'}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((c) => (
                <Tr key={c.id} _hover={{ bg: 'surface.hover' }}
                  {...(canWrite ? { cursor: 'pointer', onClick: () => ubah.open({ customer: c }) } : {})}>
                  <Td>
                    {canWrite ? (
                      // Tombol sungguhan supaya Tab + Enter juga membuka form ubah.
                      <Text as="button" type="button" fontWeight="600" color="text.primary" textAlign="left"
                        _hover={{ textDecoration: 'underline' }} aria-label={`Ubah ${c.name}`}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); ubah.open({ customer: c }) }}>
                        {c.name}
                      </Text>
                    ) : (
                      <Text fontWeight="600" color="text.primary">{c.name}</Text>
                    )}
                  </Td>
                  <Td color="text.secondary" fontSize="sm">{c.phone}</Td>
                  <Td color="text.secondary" fontSize="sm">
                    {c.id_type ? `${JENIS[c.id_type] ?? c.id_type}${c.id_number_last4 ? ` …${c.id_number_last4}` : ''}` : '—'}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()} cursor="default">
                    {canBlacklist ? (
                      // Sakelar ini tidak pernah berpindah sendiri: mengubahnya membuka
                      // dialog (alasan wajib untuk blokir), dan posisinya baru berubah
                      // setelah server mengiyakan dan daftar dimuat ulang (BR-028).
                      <Switch colorScheme="red" isChecked={c.is_blacklisted} onChange={() => blokir.open(c)}
                        aria-label={`${c.is_blacklisted ? 'Buka blokir' : 'Blokir'} ${c.name}`} />
                    ) : c.is_blacklisted ? (
                      <Tooltip label={c.blacklist_reason} hasArrow>
                        <Badge colorScheme="red" tabIndex={0}>diblokir</Badge>
                      </Tooltip>
                    ) : (
                      <Badge colorScheme="green">aktif</Badge>
                    )}
                    {/* Alasan terbaca semua peran di backoffice (BR-028). */}
                    {c.is_blacklisted && (
                      <Text fontSize="xs" color="text.secondary" mt="4px" noOfLines={2}>{c.blacklist_reason}</Text>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {rows.length === 0 && (
            <Text fontSize="sm" color="text.secondary" textAlign="center" py="40px">
              {kosongSaring}
            </Text>
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
        {/* `key` per penyewa: form diisi dari props sekali saat dipasang, jadi
            penyewa lain berarti komponen baru, bukan sisa isian yang lama. */}
        {ubah.value && (
          <CustomerDialog key={ubah.value.customer?.id ?? 'baru'} customer={ubah.value.customer}
            isOpen={ubah.isOpen} onClose={ubah.close} onCloseComplete={ubah.onCloseComplete} />
        )}
        {blokir.value && (
          <BlacklistDialog key={blokir.value.id} customer={blokir.value}
            isOpen={blokir.isOpen} onClose={blokir.close} onCloseComplete={blokir.onCloseComplete} />
        )}
      </Suspense>
    </PageShell>
  )
}
