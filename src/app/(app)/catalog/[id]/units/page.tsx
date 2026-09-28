'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useRef, useState } from 'react'

import { useCan } from 'contexts/SessionContext'
import { api, fieldErrors, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type UnitStatus = components['schemas']['UnitStatus']
type AffectedBooking = components['schemas']['AffectedBooking']

const STATUS_LABEL: Record<UnitStatus, { text: string; scheme: string }> = {
  active: { text: 'siap disewakan', scheme: 'green' },
  maintenance: { text: 'di bengkel', scheme: 'orange' },
  retired: { text: 'pensiun', scheme: 'gray' },
}

/**
 * The units of one resource.  (S1-019)
 *
 * Taking a unit out of service warns and keeps. It never refuses and never
 * cancels: the server answers 200 with the bookings that are affected, this
 * screen shows them, and the owner decides (BR-013). Refusing instead would
 * make a juragan cancel bookings one at a time before being allowed to say the
 * car is in the workshop.
 */
export default function UnitsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const canWrite = useCan('units:write')

  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const textColorSecondary = 'gray.400'
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100')

  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})

  // The warning dialog. It opens on a SUCCESSFUL status change, which reads
  // oddly until you remember the change has already happened -- this is a
  // notice about consequences, not a confirmation gate.
  const [warning, setWarning] = useState<{ code: string; bookings: AffectedBooking[] } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const { data: resource } = useQuery({
    queryKey: ['resources', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources/{id}', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })

  const { data: units, isPending } = useQuery({
    queryKey: ['resources', id, 'units'],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources/{id}/units', {
        params: { path: { id } },
      })
      if (error) throw error
      return data
    },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['resources', id, 'units'] })
    // The resource's unit_count is derived from these rows, so it goes stale
    // at the same moment they do.
    void queryClient.invalidateQueries({ queryKey: ['resources'] })
  }

  const addUnit = useMutation({
    retry: false,
    mutationFn: async () => {
      const { data, error } = await api.POST('/resources/{id}/units', {
        params: { path: { id } },
        body: { code, ...(label === '' ? {} : { label }) },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      setCode('')
      setLabel('')
      setAddErrors({})
      refresh()
    },
    onError: (problem) => {
      // The server names the field; the wording is this screen's, in the
      // language the person reading it speaks. Same split as (auth)/register.
      if (problemCode(problem) === 'validation-failed' && 'code' in fieldErrors(problem)) {
        setAddErrors({
          code: 'Plat atau nomor seri ini sudah dipakai unit lain di usaha kamu.',
        })
        return
      }
      const fields = fieldErrors(problem)
      setAddErrors(
        Object.keys(fields).length > 0 ? fields : { code: 'Unit gagal ditambahkan. Coba lagi.' },
      )
    },
  })

  const changeStatus = useMutation({
    retry: false,
    mutationFn: async (vars: { unitId: string; status: UnitStatus }) => {
      const { data, error } = await api.PATCH('/units/{id}', {
        params: { path: { id: vars.unitId } },
        body: { status: vars.status },
      })
      if (error) throw error
      return data
    },
    onSuccess: (updated) => {
      refresh()
      if (updated.status !== 'active') {
        setWarning({
          code: updated.code,
          bookings: updated.warning.affected_bookings,
        })
      }
    },
  })

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }} maxW="880px">
      <Flex align="center" justify="space-between" mb="24px" gap="16px" wrap="wrap">
        <Box>
          <Heading color={textColor} fontSize="28px" mb="4px">
            Unit {resource?.name ?? ''}
          </Heading>
          <Text color={textColorSecondary} fontSize="sm">
            Barang fisiknya, satu baris per plat atau nomor seri.
          </Text>
        </Box>
        <Button as={Link} href={`/catalog/${id}`} variant="outline" h="46px">
          Kembali ke barang
        </Button>
      </Flex>

      {canWrite && (
        <Card p="24px" mb="20px">
          <Text fontWeight="700" color={textColor} mb="16px">
            Tambah unit
          </Text>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              addUnit.mutate()
            }}
          >
            <Flex gap="16px" align="start" wrap="wrap">
              <FormControl isInvalid={addErrors.code !== undefined} flex="1" minW="200px">
                <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
                  Plat / nomor seri
                </FormLabel>
                <Input
                  isRequired
                  variant="auth"
                  fontSize="sm"
                  size="lg"
                  fontWeight="500"
                  placeholder="B 1234 XY"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <FormErrorMessage>{addErrors.code}</FormErrorMessage>
              </FormControl>
              <FormControl flex="1" minW="200px">
                <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
                  Nama panggilan
                </FormLabel>
                <Input
                  variant="auth"
                  fontSize="sm"
                  size="lg"
                  fontWeight="500"
                  placeholder="Avanza Putih"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </FormControl>
              <Button
                type="submit"
                variant="brand"
                h="50px"
                mt="32px"
                leftIcon={<AddIcon />}
                isLoading={addUnit.isPending}
              >
                Tambah
              </Button>
            </Flex>
          </form>
        </Card>
      )}

      {isPending && (
        <Flex py="60px" justify="center">
          <Spinner size="lg" color="brand.500" thickness="3px" />
        </Flex>
      )}

      {units && units.length === 0 && (
        <Card p="40px" textAlign="center">
          <Text fontWeight="700" color={textColor} mb="6px">
            Belum ada unit
          </Text>
          <Text color={textColorSecondary} fontSize="sm">
            Barang ini belum bisa dibooking sampai ada satu unit yang siap disewakan.
          </Text>
        </Card>
      )}

      {units && units.length > 0 && (
        <Card p="0" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th borderColor={borderColor}>Plat / seri</Th>
                <Th borderColor={borderColor}>Nama panggilan</Th>
                <Th borderColor={borderColor}>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {units.map((unit) => (
                <Tr key={unit.id}>
                  <Td borderColor={borderColor}>
                    <Text fontWeight="600" color={textColor}>
                      {unit.code}
                    </Text>
                  </Td>
                  <Td borderColor={borderColor} color={textColorSecondary} fontSize="sm">
                    {unit.label ?? '—'}
                  </Td>
                  <Td borderColor={borderColor}>
                    {canWrite ? (
                      <Select
                        variant="mini"
                        size="sm"
                        maxW="200px"
                        value={unit.status}
                        isDisabled={changeStatus.isPending}
                        onChange={(e) =>
                          changeStatus.mutate({
                            unitId: unit.id,
                            status: e.target.value as UnitStatus,
                          })
                        }
                      >
                        <option value="active">Siap disewakan</option>
                        <option value="maintenance">Di bengkel</option>
                        <option value="retired">Pensiun</option>
                      </Select>
                    ) : (
                      <Badge colorScheme={STATUS_LABEL[unit.status].scheme}>
                        {STATUS_LABEL[unit.status].text}
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}

      <AlertDialog
        isOpen={warning !== null}
        leastDestructiveRef={closeRef}
        onClose={() => setWarning(null)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="20px">
            <AlertDialogHeader fontSize="lg" fontWeight="700">
              {warning?.code} keluar dari peredaran
            </AlertDialogHeader>
            <AlertDialogBody>
              {warning && warning.bookings.length === 0 ? (
                <Text fontSize="sm" color={textColorSecondary}>
                  Tidak ada booking yang terdampak. Unit ini tidak akan muncul lagi di pencarian
                  ketersediaan sampai statusnya dikembalikan.
                </Text>
              ) : (
                <>
                  <Text fontSize="sm" color={textColorSecondary} mb="12px">
                    Booking di bawah ini <strong>tidak dibatalkan</strong>. Kamu yang memutuskan
                    apa yang terjadi pada masing-masing.
                  </Text>
                  <Table size="sm" variant="simple">
                    <Tbody>
                      {warning?.bookings.map((booking) => (
                        <Tr key={booking.code}>
                          <Td>{booking.code}</Td>
                          <Td>{new Date(booking.start_at).toLocaleDateString('id-ID')}</Td>
                          <Td>{booking.status}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={closeRef} variant="brand" onClick={() => setWarning(null)}>
                Mengerti
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
