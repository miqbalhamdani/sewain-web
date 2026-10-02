import type { SystemStyleObject } from '@chakra-ui/react'

import type { components } from 'lib/api/schema'

export type CalendarState = components['schemas']['CalendarState']

/**
 * The eight states of BR-033, as a juragan reads them.
 *
 * Every state except `available` carries a pattern or border of its own on top
 * of its colour, so the calendar still reads in sunlight on a phone and for
 * someone who cannot tell red from green (BR-033 rule 2). The colours are
 * tokens in theme/styles.ts; there is no hex in this file.
 */
/**
 * `short` is what a block one day wide can fit. A two-hour buffer is three
 * pixels at day scale and fits nothing; its name is in the tooltip, the
 * accessible label, and the legend that is always on screen.
 */
export const STATES: { state: CalendarState; label: string; short: string; sx: SystemStyleObject; dark?: boolean }[] = [
  { state: 'available', label: 'Tersedia', short: 'Kosong', sx: { bg: 'calendar.available' } },
  {
    state: 'reserved_unpaid',
    label: 'Dipesan · belum bayar', short: 'Pesan',
    sx: { bg: 'calendar.reserved_unpaid', border: '2px dashed', borderColor: 'calendar.ink' },
  },
  {
    state: 'reserved_paid',
    label: 'Dipesan · lunas', short: 'Lunas',
    sx: { bg: 'calendar.reserved_paid', border: '2px solid', borderColor: 'calendar.ink' },
    dark: true,
  },
  {
    state: 'picked_up',
    label: 'Sedang disewa', short: 'Sewa',
    sx: {
      bg: 'calendar.picked_up',
      backgroundImage:
        'repeating-linear-gradient(45deg, transparent 0 6px, var(--chakra-colors-whiteAlpha-500) 6px 9px)',
    },
  },
  {
    state: 'overdue',
    label: 'Terlambat', short: 'Telat',
    sx: {
      bg: 'calendar.overdue',
      border: '3px double',
      borderColor: 'calendar.ink',
      backgroundImage:
        'repeating-linear-gradient(45deg, transparent 0 5px, var(--chakra-colors-blackAlpha-300) 5px 7px),' +
        'repeating-linear-gradient(-45deg, transparent 0 5px, var(--chakra-colors-blackAlpha-300) 5px 7px)',
    },
  },
  {
    state: 'buffer',
    label: 'Jeda bersih-bersih', short: 'Jeda',
    sx: {
      bg: 'calendar.buffer',
      backgroundImage:
        'repeating-linear-gradient(135deg, transparent 0 4px, var(--chakra-colors-blackAlpha-300) 4px 6px)',
    },
  },
  {
    state: 'maintenance',
    label: 'Perawatan', short: 'Rawat',
    sx: { bg: 'calendar.maintenance', border: '2px dotted', borderColor: 'calendar.inkOnDark' },
    dark: true,
  },
  // Never drawn: a retired unit has no lane at all. It stays in the legend so
  // the vocabulary on screen is the whole of BR-033, not seven-eighths of it.
  { state: 'retired', label: 'Pensiun — tidak punya lajur', short: '—', sx: { bg: 'transparent', border: '1px solid', borderColor: 'calendar.grid' } },
]

export const BY_STATE = Object.fromEntries(STATES.map((s) => [s.state, s])) as Record<CalendarState, (typeof STATES)[number]>
