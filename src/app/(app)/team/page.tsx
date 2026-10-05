'use client'

import {
  Badge, Button, Card, Flex, FormControl, FormErrorMessage, FormLabel, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { SelectField } from 'components/fields/SelectField'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { ConfirmDialog } from 'components/table/ConfirmDialog'
import { useSession } from 'contexts/SessionContext'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'
import { formatDateTime } from 'lib/format/datetime'

type User = components['schemas']['User']
type Role = User['role']

const ROLE: Record<Role, string> = { owner: 'Pemilik', operator: 'Operator' }
const STATUS: Record<User['status'], { label: string; scheme: string }> = {
  invited: { label: 'Diundang', scheme: 'blue' },
  active: { label: 'Aktif', scheme: 'green' },
  disabled: { label: 'Nonaktif', scheme: 'gray' },
}

/**
 * Tim -- owner only.  (S1-067, BR-003, BR-004)
 *
 * Accounts are disabled, never deleted: created_by elsewhere has to stay
 * explicable. The owner's own row has no actions -- the API refuses a self
 * demote or disable, and the last active owner is never taken away.
 */
export default function TeamPage() {
  const { user: me } = useSession()
  const qc = useQueryClient()
  const toast = useToast()
  const [inviting, setInviting] = useState(false)
  const [disabling, setDisabling] = useState<User | null>(null)

  const query = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await api.GET('/users')
      if (error) throw error
      return data
    },
  })
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: components['schemas']['UpdateUserRequest'] }) => {
      const { error } = await api.PATCH('/users/{id}', { params: { path: { id } }, body })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
    onError: () => toast({ status: 'error', title: 'Perubahan ditolak', description: 'Usaha harus selalu punya minimal satu pemilik aktif.' }),
  })
  const disable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/users/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => { setDisabling(null); void qc.invalidateQueries({ queryKey: ['users'] }) },
    onError: () => { setDisabling(null); toast({ status: 'error', title: 'Tidak bisa dinonaktifkan', description: 'Usaha harus selalu punya minimal satu pemilik aktif.' }) },
  })

  const others = (query.data ?? []).filter((u) => u.id !== me?.id)
  const inviteButton = <Button variant="brand" onClick={() => setInviting(true)}>Undang anggota</Button>

  return (
    <PageShell title="Tim" subtitle="Siapa saja yang bisa masuk ke backoffice usaha ini." action={others.length > 0 ? inviteButton : undefined}>
      {query.isPending && <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" /></Flex>}
      {query.error !== null && <Card variant="panel" role="alert"><Text color="text.primary">Daftar tim gagal dimuat. Muat ulang halaman ini.</Text></Card>}
      {query.data && others.length === 0 && (
        <EmptyState title="Baru kamu sendiri" description="Undang operator untuk mencatat serah-terima dan booking. Mereka tidak melihat laporan dan pengaturan."
          action={<Flex justify="center">{inviteButton}</Flex>} />
      )}
      {query.data && others.length > 0 && (
        <Card variant="table">
          <Table variant="simple" minW="720px">
            <Thead><Tr><Th>Nama</Th><Th>Peran</Th><Th>Status</Th><Th>Terakhir masuk</Th><Th w="1%" aria-label="Aksi" /></Tr></Thead>
            <Tbody>
              {query.data.map((u) => {
                const self = u.id === me?.id
                return (
                  <Tr key={u.id}>
                    <Td>
                      <Text fontSize="sm" fontWeight="600" color="text.primary">{u.name}{self && ' (kamu)'}</Text>
                      <Text fontSize="xs" color="text.secondary">{u.email}</Text>
                    </Td>
                    <Td minW="150px">
                      {/* Native select in a table row: SelectField draws a visible label, and a
                          row already says whose role it is. */}
                      {self || u.status === 'disabled' ? <Text fontSize="sm">{ROLE[u.role]}</Text> : (
                        <Select size="sm" borderRadius="10px" aria-label={`Peran ${u.name}`} value={u.role} isDisabled={update.isPending}
                          onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value as Role } })}>
                          <option value="operator">{ROLE.operator}</option>
                          <option value="owner">{ROLE.owner}</option>
                        </Select>
                      )}
                    </Td>
                    <Td><Badge colorScheme={STATUS[u.status].scheme}>{STATUS[u.status].label}</Badge></Td>
                    <Td fontSize="sm" color="text.secondary">{u.last_login_at ? formatDateTime(u.last_login_at) : '—'}</Td>
                    <Td>
                      {!self && u.status !== 'disabled' && (
                        <Button size="sm" variant="outline" colorScheme="red" onClick={() => setDisabling(u)}>Nonaktifkan</Button>
                      )}
                      {!self && u.status === 'disabled' && (
                        <Button size="sm" variant="outline" isLoading={update.isPending}
                          onClick={() => update.mutate({ id: u.id, body: { status: 'active' } })}>Aktifkan lagi</Button>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </Card>
      )}

      <InviteDialog isOpen={inviting} onClose={() => setInviting(false)}
        onInvited={(email) => { setInviting(false); void qc.invalidateQueries({ queryKey: ['users'] })
          toast({ status: 'success', duration: 5000, title: 'Undangan terkirim', description: `Tautan masuk dikirim ke ${email}.` }) }} />
      <ConfirmDialog isOpen={disabling !== null} title={`Nonaktifkan ${disabling?.name ?? ''}?`}
        body="Ia tidak bisa masuk lagi paling lambat 15 menit dari sekarang. Riwayat yang ia catat tetap ada, dan akunnya bisa diaktifkan lagi."
        busy={disable.isPending} onCancel={() => setDisabling(null)} onConfirm={() => disabling && disable.mutate(disabling.id)} />
    </PageShell>
  )
}

function InviteDialog({ isOpen, onClose, onInvited }: { isOpen: boolean; onClose: () => void; onInvited: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [error, setError] = useState('')
  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST('/users', { body: { email: email.trim(), name: name.trim(), role } })
      if (error) throw error
    },
    onSuccess: () => { onInvited(email.trim()); setEmail(''); setName(''); setRole('operator'); setError('') },
    onError: (p) => setError(problemCode(p) === 'email-taken' ? 'Email ini sudah punya akun.' : 'Undangan gagal dikirim. Periksa email dan nama, lalu coba lagi.'),
  })
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent as="form" borderRadius="20px" onSubmit={(e) => { e.preventDefault(); invite.mutate() }}>
        <ModalHeader>Undang anggota</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb="16px" isRequired>
            <FormLabel fontSize="sm">Nama</FormLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </FormControl>
          <FormControl mb="16px" isRequired isInvalid={error !== ''}>
            <FormLabel fontSize="sm">Email</FormLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            <FormErrorMessage>{error}</FormErrorMessage>
          </FormControl>
          <SelectField label="Peran" value={role} onChange={(v) => setRole(v as Role)}
            options={[{ value: 'operator', label: ROLE.operator, hint: 'Booking, serah-terima, penyewa' },
              { value: 'owner', label: ROLE.owner, hint: 'Semua, termasuk uang dan pengaturan' }]} />
        </ModalBody>
        <ModalFooter gap="12px">
          <Button variant="ghost" onClick={onClose}>Tutup</Button>
          <Button type="submit" variant="brand" isLoading={invite.isPending}>Kirim undangan</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
