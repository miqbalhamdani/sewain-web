'use client'

import {
  Alert, AlertDescription, AlertIcon, Badge, Button, Card, Code, Flex, FormControl, FormErrorMessage, FormHelperText,
  FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner,
  Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { ConfirmDialog } from 'components/table/ConfirmDialog'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'

type ApiKey = components['schemas']['ApiKey']

/**
 * Kunci API -- owner only.  (S1-081, BR-031)
 *
 * For an owner who runs their own website and pulls the catalogue from
 * api.sewain.id. The secret is shown once, at creation, and never again; a key
 * is revoked, never deleted. The allowed origins live in /settings and are
 * edited here, beside the keys they govern.
 */
export default function ApiKeysPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api-keys')
      if (error) throw error
      return data
    },
  })
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/api-keys/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => { setRevoking(null); void qc.invalidateQueries({ queryKey: ['api-keys'] }) },
    onError: () => { setRevoking(null); toast({ status: 'error', title: 'Kunci gagal dicabut. Coba lagi.' }) },
  })

  const create = <Button variant="brand" onClick={() => setCreating(true)}>Buat kunci</Button>
  const list = keys.data ?? []

  return (
    <PageShell title="Kunci API" breadcrumb={[{ label: 'Pengaturan', href: '/settings' }]}
      subtitle="Untuk situsmu sendiri: tampilkan katalog dan terima pengajuan lewat api.sewain.id."
      action={list.length > 0 ? create : undefined}>
      <Origins />

      {keys.isPending && <Flex py="40px" justify="center"><Spinner color="brand.500" /></Flex>}
      {keys.error !== null && <Card variant="panel" role="alert"><Text>Daftar kunci gagal dimuat. Muat ulang halaman ini.</Text></Card>}
      {keys.data && list.length === 0 && (
        <EmptyState title="Belum ada kunci"
          description="Kunci hanya membuka katalog, ketersediaan, dan pengajuan — tidak pernah data penyewa atau backoffice."
          action={<Flex justify="center">{create}</Flex>} />
      )}
      {list.length > 0 && (
        <Card variant="table">
          <Table variant="simple" minW="720px">
            <Thead><Tr><Th>Nama</Th><Th>Kunci</Th><Th isNumeric>Kuota/menit</Th><Th>Terakhir dipakai</Th><Th>Status</Th><Th w="1%" aria-label="Aksi" /></Tr></Thead>
            <Tbody>
              {list.map((k) => (
                <Tr key={k.id} opacity={k.revoked_at ? 0.6 : 1}>
                  <Td fontSize="sm" fontWeight="600" color="text.primary">{k.name}</Td>
                  <Td><Code fontSize="xs">swn_live_{k.key_prefix}…</Code></Td>
                  <Td isNumeric fontSize="sm">{k.rate_limit_per_min}</Td>
                  <Td fontSize="sm" color="text.secondary">{k.last_used_at ? formatDateTime(k.last_used_at) : 'Belum pernah'}</Td>
                  <Td>{k.revoked_at
                    ? <Badge colorScheme="gray">Dicabut {formatDateTime(k.revoked_at)}</Badge>
                    : <Badge colorScheme="green">Aktif</Badge>}</Td>
                  <Td>{!k.revoked_at && (
                    <Button size="sm" variant="outline" colorScheme="red" onClick={() => setRevoking(k)}>Cabut</Button>
                  )}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}

      <CreateDialog isOpen={creating} onClose={() => { setCreating(false); void qc.invalidateQueries({ queryKey: ['api-keys'] }) }} />
      <ConfirmDialog isOpen={revoking !== null} title={`Cabut kunci ${revoking?.name ?? ''}?`}
        body="Situs yang memakai kunci ini langsung berhenti bisa memanggil API. Kuncinya tetap tercatat, tapi tidak bisa diaktifkan lagi — buat kunci baru kalau perlu."
        busy={revoke.isPending} onCancel={() => setRevoking(null)} onConfirm={() => revoking && revoke.mutate(revoking.id)} />
    </PageShell>
  )
}

/** The browser allowlist (BR-031): a browser control, not a security one. */
function Origins() {
  const qc = useQueryClient()
  const toast = useToast()
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await api.GET('/settings')
      if (error) throw error
      return data
    },
  })
  // null until the person types: a refetch (window focus, staleTime 0) must
  // never overwrite what they are in the middle of editing.
  const [edited, setEdited] = useState<string | null>(null)
  const text = edited ?? settings.data?.allowed_origins.join('\n') ?? ''
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const origins = text.split('\n').map((l) => l.trim().replace(/\/+$/, '')).filter(Boolean)
      const { data, error } = await api.PATCH('/settings', { body: { allowed_origins: origins } })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data)
      setEdited(null)
      setError('')
      toast({ status: 'success', duration: 3000, title: 'Origin disimpan' })
    },
    onError: () => setError('Tiap baris satu alamat situs, misalnya https://rentalbudi.com — tanpa path. Maksimal 20.'),
  })
  return (
    <Card variant="section" mb="20px">
      <Text fontWeight="700" color="text.primary" mb="4px">Situs yang diizinkan</Text>
      <Text fontSize="xs" color="text.secondary" mb="12px">
        Browser hanya mengizinkan situs di daftar ini memanggil API. Ini bukan pengaman — kunci yang bocor tetap
        bisa dipakai dari luar browser, karena itu kunci punya kuota dan bisa dicabut.
      </Text>
      <FormControl isInvalid={error !== ''}>
        <FormLabel fontSize="sm">Satu per baris</FormLabel>
        <Textarea rows={3} value={text} onChange={(e) => setEdited(e.target.value)} isDisabled={!settings.data} placeholder="https://rentalbudi.com" fontFamily="mono" fontSize="sm" />
        {error ? <FormErrorMessage>{error}</FormErrorMessage> : <FormHelperText fontSize="xs">Kosong = tidak ada situs lain yang boleh.</FormHelperText>}
      </FormControl>
      <Flex justify="flex-end" mt="12px">
        <Button size="sm" variant="brand" isLoading={save.isPending} isDisabled={!settings.data} onClick={() => save.mutate()}>Simpan</Button>
      </Flex>
    </Card>
  )
}

function CreateDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [perMin, setPerMin] = useState('60')
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState('')
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api-keys', { body: { name: name.trim(), rate_limit_per_min: Number(perMin) || 60 } })
      if (error) throw error
      return data
    },
    onSuccess: (data) => { setSecret(data.secret); setError('') },
    onError: () => setError('Nama 1–80 karakter, kuota 1–600 per menit.'),
  })
  const close = () => { setSecret(null); setName(''); setPerMin('60'); setError(''); onClose() }

  return (
    <Modal isOpen={isOpen} onClose={close} isCentered closeOnOverlayClick={secret === null} size="lg">
      <ModalOverlay />
      {secret ? (
        <ModalContent borderRadius="20px">
          <ModalHeader>Simpan kuncinya sekarang</ModalHeader>
          <ModalBody>
            <Alert status="warning" borderRadius="12px" mb="16px">
              <AlertIcon />
              <AlertDescription fontSize="sm">Rahasia ini hanya tampil sekali dan tidak bisa dilihat lagi. Kalau hilang, cabut lalu buat kunci baru.</AlertDescription>
            </Alert>
            <Code display="block" p="12px" borderRadius="8px" fontSize="sm" wordBreak="break-all">{secret}</Code>
            <Text fontSize="xs" color="text.secondary" mt="12px">Kirim sebagai header <Code fontSize="xs">X-API-Key</Code> ke api.sewain.id/api/v1/public/….</Text>
          </ModalBody>
          <ModalFooter gap="12px">
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(secret).then(() =>
              toast({ status: 'success', duration: 2500, title: 'Kunci disalin' }))}>Salin</Button>
            <Button variant="brand" onClick={close}>Sudah saya simpan</Button>
          </ModalFooter>
        </ModalContent>
      ) : (
        <ModalContent as="form" borderRadius="20px" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
          <ModalHeader>Buat kunci API</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired isInvalid={error !== ''} mb="16px">
              <FormLabel fontSize="sm">Nama</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="situs rentalbudi.com" />
              <FormErrorMessage>{error}</FormErrorMessage>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Kuota per menit</FormLabel>
              <Input value={perMin} inputMode="numeric" onChange={(e) => setPerMin(e.target.value.replace(/\D/g, ''))} maxW="120px" />
              <FormHelperText fontSize="xs">Lewat dari ini, panggilan ditolak sampai menit berikutnya.</FormHelperText>
            </FormControl>
          </ModalBody>
          <ModalFooter gap="12px">
            <Button variant="ghost" onClick={close}>Tutup</Button>
            <Button type="submit" variant="brand" isLoading={create.isPending}>Buat kunci</Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  )
}
