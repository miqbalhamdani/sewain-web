/**
 * Format tanggal & waktu untuk tampilan.
 *
 * CLAUDE.md menyebut berkas ini sebagai rumahnya ("Pakai `lib/format`"), tapi
 * sebelum ini ia belum ada dan `toLocaleDateString('id-ID')` ditulis di tempat.
 */

const TIMEZONE = 'Asia/Jakarta'

/**
 * Tanggal polos `YYYY-MM-DD` -> "15 Mar 2027".
 *
 * Diurai per komponen, BUKAN lewat `new Date(iso)`: string tanggal polos diurai
 * peramban sebagai tengah malam UTC, dan di zona barat tanggalnya mundur sehari.
 * Yang ini tidak punya zona sama sekali -- ia hari di kalender, bukan sesaat.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** `YYYY-MM-DD` dari sebuah Date lokal, tanpa lewat UTC. */
export function toISODate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** `YYYY-MM-DD` -> Date lokal di tengah hari, aman dari pergeseran zona. */
export function fromISODate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/**
 * Timestamp UTC dari API -> tanggal di Asia/Jakarta.
 *
 * API memakai UTC; tampilan memakai waktu Jakarta. Ini yang kedua.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * `<input type="datetime-local">` speaks wall-clock time with no zone. This
 * system's wall clock is Jakarta's, so the value is pinned to +07:00 before it
 * reaches the API -- never left to the browser's own zone, which would move a
 * 09:00 booking made from a laptop set to anything else.
 */
export function fromJakartaLocal(value: string): string {
  return value.length === 16 ? `${value}:00+07:00` : `${value}+07:00`
}

/** The inverse: an API timestamp → `YYYY-MM-DDTHH:mm` in Jakarta, for the input. */
export function toJakartaLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** `[start, end)` as a juragan reads it: "3 Sep 2026 09.00 – 5 Sep 2026 09.00". */
export function formatRange(startIso: string, endIso: string): string {
  return `${formatDateTime(startIso)} – ${formatDateTime(endIso)}`
}

/** API timestamp → "Sab, 3 Okt 09.00" in Jakarta: short enough for one line of a form. */
export function formatDayTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
