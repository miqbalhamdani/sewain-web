'use client'

import { Box, Card, Heading, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react'

import { useSession } from 'contexts/SessionContext'

/**
 * The dashboard, as far as M0 takes it.
 *
 * Horizon's demo lived here: fake revenue, fake traffic, a fake task list. It
 * is gone rather than kept as a placeholder — a screen full of invented
 * numbers is worse than an empty one, because somebody eventually reads them
 * as real.
 *
 * The real dashboard is S1-063 in M5: overdue bookings as warnings, and the
 * "deposit belum diselesaikan" list beside them. Nothing here pretends to be
 * that yet.
 */
export default function Dashboard() {
  const { user, owner } = useSession()
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const textColorSecondary = 'gray.400'

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Heading color={textColor} fontSize="28px" mb="8px">
        {owner?.name}
      </Heading>
      <Text color={textColorSecondary} mb="28px">
        Masuk sebagai {user?.name} · {user?.role === 'owner' ? 'Pemilik' : 'Operator'}
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px">
        <Card p="20px">
          <Text fontWeight="700" color={textColor} mb="6px">
            Langkah berikutnya
          </Text>
          <Text color={textColorSecondary} fontSize="sm">
            Katalog, unit, dan booking pertama datang di M1–M2. Daftar langkah yang dihitung dari
            data — bukan dari kolom progres — adalah `S1-066`.
          </Text>
        </Card>

        <Card p="20px">
          <Text fontWeight="700" color={textColor} mb="6px">
            Pengaturan usaha
          </Text>
          <Text color={textColorSecondary} fontSize="sm">
            Prefix kode booking, tenggat bayar, dan toleransi no-show sudah bisa diatur lewat API
            (`S1-009`). Layarnya menyusul di `S1-066`.
          </Text>
        </Card>
      </SimpleGrid>
    </Box>
  )
}
