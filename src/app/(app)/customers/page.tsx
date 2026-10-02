'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Badge,
  Button,
  Card,
  Flex,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useDeferredValue, useState } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { TableSearch } from 'components/table/TableSearch'
import { useCan } from 'contexts/SessionContext'
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
  const [dialog, setDialog] = useState<{ customer: Customer | null } | null>(null)
  const [blokir, setBlokir] = useState<Customer | null>(null)

  const query = useInfiniteQuery({
    queryKey: ['customers', q],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET('/customers', {
        params: { query: { ...(q !== '' ? { q } : {}), ...(pageParam ? { cursor: pageParam } : {}) } },
      })
      if (error) throw error
      return data
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  const rows = query.data?.pages.flatMap((p) => p.data) ?? []
  const kosongTotal = !query.isPending && rows.length === 0 && q === ''

  const tambah = canWrite && (
    <Button variant="brand" leftIcon={<AddIcon />} onClick={() => setDialog({ customer: null })}>
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
            resultCount={rows.length} totalCount={rows.length} />
          <Table variant="simple" minW="720px">
            <Thead>
              <Tr>
                <Th>Nama</Th>
                <Th>Telepon</Th>
                <Th>Identitas</Th>
                <Th>Status</Th>
                <Th w="1%" aria-label="Aksi" />
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((c) => (
                <Tr key={c.id} _hover={{ bg: 'surface.hover' }}>
                  <Td><Text fontWeight="600" color="text.primary">{c.name}</Text></Td>
                  <Td color="text.secondary" fontSize="sm">{c.phone}</Td>
                  <Td color="text.secondary" fontSize="sm">
                    {c.id_type ? `${JENIS[c.id_type] ?? c.id_type}${c.id_number_last4 ? ` …${c.id_number_last4}` : ''}` : '—'}
                  </Td>
                  <Td>
                    {c.is_blacklisted ? (
                      // Alasan terbaca semua peran di backoffice (BR-028).
                      <Tooltip label={c.blacklist_reason} hasArrow>
                        <Badge colorScheme="red" tabIndex={0}>diblokir</Badge>
                      </Tooltip>
                    ) : (
                      <Badge colorScheme="green">aktif</Badge>
                    )}
                    {c.is_blacklisted && (
                      <Text fontSize="xs" color="text.secondary" mt="4px" noOfLines={2}>{c.blacklist_reason}</Text>
                    )}
                  </Td>
                  <Td>
                    <Flex gap="8px" justify="flex-end">
                      {canWrite && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ customer: c })}>Ubah</Button>
                      )}
                      {canBlacklist && (
                        <Button size="sm" variant="outline" colorScheme={c.is_blacklisted ? 'brand' : 'red'}
                          onClick={() => setBlokir(c)}>
                          {c.is_blacklisted ? 'Buka blokir' : 'Blokir'}
                        </Button>
                      )}
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {rows.length === 0 && (
            <Text fontSize="sm" color="text.secondary" textAlign="center" py="40px">
              Tidak ada penyewa dengan nama atau telepon itu.
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

      {dialog && <CustomerDialog isOpen onClose={() => setDialog(null)} customer={dialog.customer} />}
      {blokir && <BlacklistDialog customer={blokir} onClose={() => setBlokir(null)} />}
    </PageShell>
  )
}
