'use client'

import { Box, Flex, Text } from '@chakra-ui/react'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { components } from 'lib/api/schema'

import { BY_STATE } from './states'

type Row = components['schemas']['CalendarRow']

/** Satu barang beserta lajur unit-unitnya, sudah tersaring & terurut. */
export type CalendarGroup = { id: string; name: string; rows: Row[] }

type Baris =
  | { kind: 'header'; id: string; name: string; count: number }
  | { kind: 'lane'; row: Row }

export const DAY_MS = 24 * 3600 * 1000
// 14 hari pas selebar kartu; di layar sempit kolom berhenti di 44px dan
// sisa periodenya jadi scroll samping.
const FIT_DAYS = 14
const MIN_COL_W = 44
const ROW_H = 48
const LABEL_W = 180
const HEADER_H = 44
const OVERSCAN = 4

const HARI = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short' })
const TGL = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' })

/**
 * The lanes, windowed in both directions.  (S1-028)
 *
 * Only the rows and days inside the viewport (plus a small overscan) are in the
 * DOM -- 200 units x 365 days is 73,000 cells, and the browser should never be
 * asked to lay them out. Scrolling and panning inside the loaded range only
 * move the window; nothing here fetches.
 *
 * ponytail: hand-rolled windowing, ~40 lines; swap in @tanstack/react-virtual
 * if scroll ever janks at 200 x 365 on a low-end phone.
 */
export function CalendarGrid({ groups, start, days, scrollToDay }: {
  groups: CalendarGroup[]
  /** Jakarta midnight of day 0, as epoch ms. */
  start: number
  days: number
  /** Changing this scrolls the grid so that day is at the left edge. */
  scrollToDay: number
}) {
  // Kepala barang dan lajur unit di SATU daftar rata bertinggi seragam, supaya
  // matematika windowing-nya tidak berubah.
  const baris = useMemo<Baris[]>(() => groups.flatMap((g): Baris[] => [
    { kind: 'header', id: g.id, name: g.name, count: g.rows.length },
    ...g.rows.map((row): Baris => ({ kind: 'lane', row })),
  ]), [groups])

  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ left: 0, top: 0, width: 1200, height: 600 })
  const colW = Math.max(MIN_COL_W, (view.width - LABEL_W) / FIT_DAYS)

  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = scrollToDay * colW
  }, [scrollToDay, start, colW])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => setView({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, height: el.clientHeight })
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    el.addEventListener('scroll', sync, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', sync)
    }
  }, [])

  const firstDay = Math.max(0, Math.floor(view.left / colW) - OVERSCAN)
  const lastDay = Math.min(days, Math.ceil((view.left + view.width - LABEL_W) / colW) + OVERSCAN)
  const firstRow = Math.max(0, Math.floor(view.top / ROW_H) - OVERSCAN)
  const lastRow = Math.min(baris.length, Math.ceil((view.top + view.height - HEADER_H) / ROW_H) + OVERSCAN)
  const winFrom = start + firstDay * DAY_MS
  const winTo = start + lastDay * DAY_MS
  const today = Math.floor((Date.now() - start) / DAY_MS)
  const x = (ms: number) => ((ms - start) / DAY_MS) * colW

  return (
    <Box ref={ref} position="relative" overflow="auto" h="min(70vh, 720px)" borderRadius="16px"
      borderWidth="1px" borderColor="calendar.grid" tabIndex={0} aria-label="Kalender ketersediaan per unit">
      <Box position="relative" w={`${LABEL_W + days * colW}px`} h={`${HEADER_H + baris.length * ROW_H}px`}>
        {/* Day header, sticky to the top. */}
        <Box position="sticky" top="0" zIndex={3} h={`${HEADER_H}px`} bg="white" _dark={{ bg: 'navy.800' }}>
          <Box position="sticky" left="0" zIndex={4} w={`${LABEL_W}px`} h="100%" bg="white" _dark={{ bg: 'navy.800' }}
            borderRightWidth="1px" borderBottomWidth="1px" borderColor="calendar.grid" />
          {Array.from({ length: lastDay - firstDay }, (_, i) => {
            const d = firstDay + i
            const t = new Date(start + d * DAY_MS)
            // Locale-nya tetap id-ID, jadi membandingkan nama harinya aman.
            const nama = HARI.format(t)
            return (
              <Box key={d} position="absolute" top="0" left={`${LABEL_W + d * colW}px`} w={`${colW}px`} h="100%"
                textAlign="center" pt="4px" borderBottomWidth="1px" borderColor="calendar.grid"
                fontWeight={d === today ? '700' : '400'}
                color={d === today ? 'brand.500' : nama === 'Min' ? 'red.400' : 'text.secondary'} fontSize="xs">
                <div>{nama}</div>
                <div>{TGL.format(t)}</div>
              </Box>
            )
          })}
        </Box>

        {baris.slice(firstRow, lastRow).map((b, i) => {
          const r = firstRow + i
          if (b.kind === 'header') {
            return (
              <Box key={`h-${b.id}`} position="absolute" top={`${HEADER_H + r * ROW_H}px`} left="0" w="100%"
                h={`${ROW_H}px`} bg="gray.50" _dark={{ bg: 'whiteAlpha.50' }}
                borderBottomWidth="1px" borderColor="calendar.grid">
                <Flex position="sticky" left="0" zIndex={2} w={`${LABEL_W}px`} h="100%" px="12px"
                  align="center" gap="6px" borderRightWidth="1px" borderColor="calendar.grid">
                  <Link href={`/catalog/${b.id}`}>
                    <Text as="span" fontSize="sm" fontWeight="700" color="text.primary" noOfLines={1}
                      _hover={{ textDecoration: 'underline' }}>
                      {b.name}
                    </Text>
                  </Link>
                  <Text fontSize="xs" color="text.secondary" whiteSpace="nowrap">· {b.count} unit</Text>
                </Flex>
              </Box>
            )
          }
          const row = b.row
          return (
            <Box key={row.unit.id} position="absolute" top={`${HEADER_H + r * ROW_H}px`} left="0"
              w="100%" h={`${ROW_H}px`} borderBottomWidth="1px" borderColor="calendar.grid">
              {row.segments
                .filter((s) => Date.parse(s.to) > winFrom && Date.parse(s.from) < winTo)
                .map((s) => {
                  const meta = BY_STATE[s.state]
                  const left = Math.max(x(Date.parse(s.from)), x(winFrom))
                  const right = Math.min(x(Date.parse(s.to)), x(winTo))
                  const teks = s.booking ? `${meta.label} · ${s.booking.code} · ${s.booking.customer_name}` : meta.label
                  const block = (
                    <Box position="absolute" left={`${LABEL_W + left}px`} w={`${Math.max(right - left, 2)}px`}
                      top="4px" bottom="4px" borderRadius="6px" overflow="hidden" px="6px" sx={meta.sx}
                      title={teks} aria-label={teks}>
                      <Text fontSize="10px" lineHeight="38px" whiteSpace="nowrap" fontWeight="600"
                        color={meta.dark ? 'calendar.inkOnDark' : 'calendar.ink'}>
                        {right - left > 110 ? teks : right - left > 28 ? meta.short : ''}
                      </Text>
                    </Box>
                  )
                  return s.booking ? (
                    <Link key={s.from} href={`/bookings/${s.booking.id}`}>{block}</Link>
                  ) : (
                    <Box key={s.from}>{block}</Box>
                  )
                })}
              {/* Unit label, sticky to the left, above the blocks. */}
              <Box position="sticky" left="0" zIndex={2} w={`${LABEL_W}px`} h="100%" px="12px" py="6px"
                bg="white" _dark={{ bg: 'navy.800' }} borderRightWidth="1px" borderColor="calendar.grid">
                <Text fontSize="sm" fontWeight="600" color="text.primary" noOfLines={1}>{row.unit.label ?? row.unit.code}</Text>
                {row.unit.label && <Text fontSize="xs" color="text.secondary" noOfLines={1}>{row.unit.code}</Text>}
              </Box>
            </Box>
          )
        })}

        {/* Band kolom hari ini: overlay tipis DI ATAS blok (pointerEvents none),
            di bawah label unit sticky (z2) dan header (z3). */}
        {today >= 0 && today < days && (
          <Box aria-hidden position="absolute" top={`${HEADER_H}px`} bottom="0"
            left={`${LABEL_W + today * colW}px`} w={`${colW}px`}
            bg="calendar.todayBand" pointerEvents="none" zIndex={1} />
        )}
      </Box>
    </Box>
  )
}
