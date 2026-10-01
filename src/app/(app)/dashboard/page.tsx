'use client'

import { Card, SimpleGrid, Text } from '@chakra-ui/react'

import { PageShell } from 'components/layout/PageShell'
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
  const { user } = useSession()

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Masuk sebagai ${user?.name ?? ''} · ${user?.role === 'owner' ? 'Pemilik' : 'Operator'}`}
    >
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px">
        <Card p="20px">
          <Text fontWeight="700" color="text.primary" mb="6px">
            Langkah berikutnya
          </Text>
          <Text color="text.secondary" fontSize="sm">
            Katalog, unit, dan booking pertama datang di M1–M2. Daftar langkah yang dihitung dari
            data — bukan dari kolom progres — adalah `S1-066`.
          </Text>
        </Card>

        <Card p="20px">
          <Text fontWeight="700" color="text.primary" mb="6px">
            Pengaturan usaha
          </Text>
          <Text color="text.secondary" fontSize="sm">
            Prefix kode booking, tenggat bayar, dan toleransi no-show sudah bisa diatur lewat API
            (`S1-009`). Layarnya menyusul di `S1-066`.
          </Text>
        </Card>
      </SimpleGrid>
    </PageShell>
  )
}
