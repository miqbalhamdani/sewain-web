'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
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
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatPrice } from 'lib/format/money'

/**
 * The catalogue.  (S1-018)
 *
 * Reading is open to both roles -- an operator's whole job, from booking to
 * handover, points at this list. Writing is the owner's (BR-003), and the
 * actions an operator does not have are not rendered rather than disabled.
 */
export default function CatalogPage() {
  const canWrite = useCan('resources:write')
  const canSeePrices = useCan('pricing:write')

  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const textColorSecondary = 'gray.400'
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.50')

  const { data, isPending, error } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources')
      if (error) throw error
      return data
    },
  })

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Flex align="center" justify="space-between" mb="24px" gap="16px" wrap="wrap">
        <Box>
          <Heading color={textColor} fontSize="28px" mb="4px">
            Barang
          </Heading>
          <Text color={textColorSecondary} fontSize="sm">
            Jenis barang yang kamu sewakan. Unit fisiknya diatur di dalam masing-masing.
          </Text>
        </Box>
        {canWrite && (
          <Button as={Link} href="/catalog/new" variant="brand" leftIcon={<AddIcon />} h="46px">
            Tambah barang
          </Button>
        )}
      </Flex>

      {isPending && (
        <Flex py="60px" justify="center">
          <Spinner size="lg" color="brand.500" thickness="3px" />
        </Flex>
      )}

      {error !== null && !isPending && (
        <Card p="20px">
          <Text color={textColor}>Daftar barang gagal dimuat. Muat ulang halaman ini.</Text>
        </Card>
      )}

      {data && data.length === 0 && (
        /* One honest primary action rather than "tidak ada data": the person
           who reaches an empty catalogue needs the next step, not a status. */
        <Card p="40px" textAlign="center">
          <Text fontWeight="700" color={textColor} mb="6px">
            Belum ada barang
          </Text>
          <Text color={textColorSecondary} fontSize="sm" mb="20px">
            Mulai dari satu jenis barang — misalnya &ldquo;Avanza 2021&rdquo; — lalu tambahkan
            unit fisiknya satu per satu.
          </Text>
          {canWrite && (
            <Button as={Link} href="/catalog/new" variant="brand" mx="auto" w="fit-content">
              Tambah barang pertama
            </Button>
          )}
        </Card>
      )}

      {data && data.length > 0 && (
        <Card p="0" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th borderColor={borderColor}>Nama</Th>
                <Th borderColor={borderColor}>Kategori</Th>
                {/* BR-003: the price column is not rendered for an operator at
                    all -- not blanked, not greyed. */}
                {canSeePrices && <Th borderColor={borderColor}>Harga</Th>}
                <Th borderColor={borderColor} isNumeric>
                  Unit aktif
                </Th>
                <Th borderColor={borderColor}>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.map((resource) => (
                <Tr key={resource.id} _hover={{ bg: hoverBg }}>
                  <Td borderColor={borderColor}>
                    <Link href={`/catalog/${resource.id}`}>
                      <Text fontWeight="600" color={textColor}>
                        {resource.name}
                      </Text>
                    </Link>
                  </Td>
                  <Td borderColor={borderColor} color={textColorSecondary} fontSize="sm">
                    {resource.category ?? '—'}
                  </Td>
                  {canSeePrices && (
                    <Td borderColor={borderColor} color={textColor} fontSize="sm">
                      {formatPrice(resource.base_price, resource.pricing_unit)}
                    </Td>
                  )}
                  <Td borderColor={borderColor} isNumeric>
                    {resource.unit_count === 0 ? (
                      /* BR-010: no active unit means this resource can never
                         appear in availability search, whatever its own status
                         says. Saying so here is cheaper than the owner working
                         it out from an empty calendar. */
                      <Badge colorScheme="orange">belum ada unit</Badge>
                    ) : (
                      <Text color={textColor}>{resource.unit_count}</Text>
                    )}
                  </Td>
                  <Td borderColor={borderColor}>
                    <Badge colorScheme={resource.status === 'active' ? 'green' : 'gray'}>
                      {resource.status === 'active' ? 'aktif' : 'nonaktif'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}
    </Box>
  )
}
