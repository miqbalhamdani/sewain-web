'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { Box, Button, Card, Flex, IconButton, Spinner, Text, Wrap, WrapItem } from '@chakra-ui/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { api } from 'lib/api/client'

import { CalendarGrid, DAY_MS } from './CalendarGrid'
import { STATES } from './states'

const BULAN = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' })

/** Month index (year*12 + month) → Jakarta midnight on its 1st, as epoch ms. */
function monthStart(m: number): number {
  const y = Math.floor(m / 12)
  const mm = String((m % 12) + 1).padStart(2, '0')
  return Date.parse(`${y}-${mm}-01T00:00:00+07:00`)
}

function thisMonth(): number {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
    .format(new Date()).split('-').map(Number)
  return y * 12 + (m - 1)
}

/**
 * Kalender ketersediaan.  (S1-028, BR-033)
 *
 * One `GET /calendar` per loaded window of three months; moving between months
 * inside that window only scrolls. Every state comes from the server -- this
 * screen never assembles one from booking + invoice + unit status.
 *
 * Deviation, written down rather than hidden (05-backlog.md M2 note): the first
 * paint is client-rendered, one fetch, no waterfall. The access token lives
 * only in browser memory, so a server component has nothing to call the API
 * with yet; solving that is its own item.
 */
export default function CalendarPage() {
  const [bulan, setBulan] = useState(thisMonth)
  // The loaded window starts one month before the shown month, and only moves
  // when the shown month leaves it.
  const [jendela, setJendela] = useState(() => thisMonth() - 1)
  const from = monthStart(jendela)
  const to = monthStart(jendela + 3)
  const days = Math.round((to - from) / DAY_MS)

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['calendar', from],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await api.GET('/calendar', {
        params: { query: { from: new Date(from).toISOString(), to: new Date(to).toISOString() } },
      })
      if (error) throw error
      return data.data
    },
  })

  function pindah(m: number) {
    setBulan(m)
    if (m < jendela || m > jendela + 2) setJendela(m - 1)
  }

  const scrollToDay = Math.round((monthStart(bulan) - from) / DAY_MS)

  return (
    <PageShell title="Kalender" subtitle="Satu lajur per unit. Klik blok booking untuk membukanya.">
      <Flex align="center" gap="10px" mb="16px">
        <IconButton aria-label="Bulan sebelumnya" icon={<ChevronLeftIcon />} variant="outline" size="sm" onClick={() => pindah(bulan - 1)} />
        <Text fontWeight="700" color="text.primary" minW="150px" textAlign="center">{BULAN.format(new Date(monthStart(bulan)))}</Text>
        <IconButton aria-label="Bulan berikutnya" icon={<ChevronRightIcon />} variant="outline" size="sm" onClick={() => pindah(bulan + 1)} />
        <Button size="sm" variant="link" colorScheme="brand" onClick={() => pindah(thisMonth())}>Bulan ini</Button>
        {isFetching && !isPending && <Spinner size="sm" />}
      </Flex>

      {/* The legend is always on screen (BR-033 rule 2): every state with its
          own swatch, drawn with the same pattern as the blocks. */}
      <Card variant="section" mb="16px" p="12px 16px">
        <Wrap spacing="14px" as="ul" aria-label="Legenda keadaan">
          {STATES.map((s) => (
            <WrapItem key={s.state} as="li" alignItems="center" gap="6px">
              <Box w="22px" h="14px" borderRadius="3px" sx={s.sx} aria-hidden />
              <Text fontSize="xs" color="text.primary">{s.label}</Text>
            </WrapItem>
          ))}
        </Wrap>
      </Card>

      {isPending && <Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" thickness="3px" /></Flex>}
      {error !== null && !isPending && (
        <Card variant="panel" role="alert"><Text color="text.primary">Kalender gagal dimuat. Muat ulang halaman ini.</Text></Card>
      )}
      {data && data.length === 0 && (
        <EmptyState
          title="Belum ada unit untuk ditampilkan"
          description="Kalender punya satu lajur per unit. Tambahkan barang dan unit fisiknya dulu."
          action={<Flex justify="center"><Button as={Link} href="/catalog" variant="brand">Ke daftar barang</Button></Flex>}
        />
      )}
      {data && data.length > 0 && <CalendarGrid rows={data} start={from} days={days} scrollToDay={scrollToDay} />}
    </PageShell>
  )
}
