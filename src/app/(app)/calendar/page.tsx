'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { Box, Button, Card, Flex, IconButton, Spinner, Text, Wrap, WrapItem } from '@chakra-ui/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { MultiSelectField } from 'components/fields/MultiSelectField'
import type { SelectOption } from 'components/fields/SelectField'
import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { api } from 'lib/api/client'

import { resourcesQuery } from '../catalog/queries'

import { CalendarGrid, DAY_MS, type CalendarGroup } from './CalendarGrid'
import { STATES } from './states'

const TGL_AWAL = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short' })
const TGL_AKHIR = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Satu halaman = Senin–Minggu, 14 hari. Jangkarnya Senin 1 Jan 2024 WIB —
 * Jakarta tanpa DST, jadi aritmetika epoch polos di bawah ini aman.
 */
const PERIOD_DAYS = 14
const PERIOD_MS = PERIOD_DAYS * DAY_MS
const WEEK_MS = 7 * DAY_MS
const EPOCH_SENIN = Date.parse('2024-01-01T00:00:00+07:00')

/**
 * Periode diindeks per MINGGU, bukan per blok-14-hari tetap: "Minggu ini"
 * harus mulai di Senin minggu berjalan, bukan di Senin dua minggu lalu
 * kalau hari ini kebetulan jatuh di paruh kedua sebuah blok tetap.
 */
function periodStart(w: number): number {
  return EPOCH_SENIN + w * WEEK_MS
}

/** Minggu berjalan: Senin-nya jadi hari pertama di layar. */
function thisPeriod(): number {
  return Math.floor((Date.now() - EPOCH_SENIN) / WEEK_MS)
}

/**
 * Kalender ketersediaan.  (S1-028, BR-033)
 *
 * One `GET /calendar` per loaded window of three two-week periods; moving
 * between periods inside that window only scrolls. Every state comes from the
 * server -- this
 * screen never assembles one from booking + invoice + unit status.
 *
 * Deviation, written down rather than hidden (05-backlog.md M2 note): the first
 * paint is client-rendered, one fetch, no waterfall. The access token lives
 * only in browser memory, so a server component has nothing to call the API
 * with yet; solving that is its own item.
 */
export default function CalendarPage() {
  const [periode, setPeriode] = useState(thisPeriod)
  // The loaded window (6 weeks) starts one period before the shown one, and
  // only moves when the shown period leaves it.
  const [jendela, setJendela] = useState(() => thisPeriod() - 2)
  const from = periodStart(jendela)
  const to = periodStart(jendela + 6)
  const days = Math.round((to - from) / DAY_MS)

  const resources = useQuery(resourcesQuery)
  const [barang, setBarang] = useState<SelectOption[]>([])

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

  function pindah(p: number) {
    setPeriode(p)
    // Periode tampil = minggu [p, p+2); jendela = minggu [jendela, jendela+6).
    if (p < jendela || p + 2 > jendela + 6) setJendela(p - 2)
  }

  const scrollToDay = (periode - jendela) * 7

  // Dikelompokkan per barang, disaring di klien: seluruh jendela sudah ada di
  // memori dari satu GET /calendar, jadi menyaring tidak menyentuh server.
  const groups = useMemo<CalendarGroup[]>(() => {
    if (!data) return []
    const nama = new Map((resources.data ?? []).map((r) => [r.id, r.name]))
    const pilih = new Set(barang.map((o) => o.value))
    const byId = new Map<string, typeof data>()
    for (const row of data) {
      if (pilih.size > 0 && !pilih.has(row.resource_id)) continue
      byId.set(row.resource_id, [...(byId.get(row.resource_id) ?? []), row])
    }
    return [...byId.entries()]
      .map(([id, rows]) => ({ id, name: nama.get(id) ?? '…', rows }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [data, resources.data, barang])

  return (
    <PageShell title="Kalender" subtitle="Satu lajur per unit. Klik blok booking untuk membukanya.">
      <Flex align="center" gap="10px" mb="16px">
        <IconButton aria-label="Dua minggu sebelumnya" icon={<ChevronLeftIcon />} variant="outline" size="sm" onClick={() => pindah(periode - 2)} />
        <Text fontWeight="700" color="text.primary" minW="240px" textAlign="center" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {TGL_AWAL.format(new Date(periodStart(periode)))} – {TGL_AKHIR.format(new Date(periodStart(periode) + PERIOD_MS - DAY_MS))}
        </Text>
        <IconButton aria-label="Dua minggu berikutnya" icon={<ChevronRightIcon />} variant="outline" size="sm" onClick={() => pindah(periode + 2)} />
        <Button size="sm" variant="link" colorScheme="brand" onClick={() => pindah(thisPeriod())}>Minggu ini</Button>
        {isFetching && !isPending && <Spinner size="sm" />}
      </Flex>

      {/* The legend is always on screen (BR-033 rule 2): every state with its
          own swatch, drawn with the same pattern as the blocks. */}
      <Flex gap="16px" align="flex-start" wrap="wrap" mb="16px">
        <Card variant="section" p="12px 16px" flex="1" minW="280px">
          <Wrap spacing="14px" as="ul" aria-label="Legenda keadaan">
            {STATES.map((s) => (
              <WrapItem key={s.state} as="li" alignItems="center" gap="6px">
                <Box w="26px" h="16px" borderRadius="4px" sx={s.sx} aria-hidden />
                <Text fontSize="xs" color="text.primary">{s.label}</Text>
              </WrapItem>
            ))}
          </Wrap>
        </Card>
        <Box w={{ base: '100%', md: '280px' }}>
          <MultiSelectField label="Barang" placeholder="Semua barang" value={barang} onChange={setBarang}
            options={(resources.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
            isLoading={resources.isPending} />
        </Box>
      </Flex>

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
      {data && data.length > 0 && groups.length === 0 && (
        <Card variant="panel"><Text fontSize="sm" color="text.primary">Tidak ada lajur untuk barang itu.</Text></Card>
      )}
      {groups.length > 0 && <CalendarGrid groups={groups} start={from} days={days} scrollToDay={scrollToDay} />}
    </PageShell>
  )
}
