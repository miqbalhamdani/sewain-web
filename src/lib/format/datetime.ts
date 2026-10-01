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
