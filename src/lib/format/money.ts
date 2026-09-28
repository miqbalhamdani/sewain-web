/**
 * Rupiah, in full.  (S1-018)
 *
 * `350000` means Rp 350.000. Full rupiah, never minor units.
 *
 * This differs from `new-commerce-web`, where `19900000` means Rp 199.000. Do
 * not port its helpers without stripping the division by 100: getting the
 * direction wrong once produces an invoice 100x off, and that invoice really
 * does reach a renter.
 */

const FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

/** `350000` → `"Rp 350.000"`. */
export function formatRupiah(value: number): string {
  return FORMATTER.format(value)
}

/** `350000` → `"350.000"`, for an input the person is editing. */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

/**
 * What the person typed → an integer, or null when they left it empty.
 *
 * Null rather than 0, and that distinction is the whole reason this function
 * exists rather than a `Number()` call at each site: for deposit, late fee and
 * duration bounds, empty means the rule does not apply while 0 is refused by
 * the database outright (BR-016).
 *
 * Never parseFloat. Separators are dropped, a decimal part is refused rather
 * than rounded, and the value stays integral all the way to the API.
 */
export function parseRupiah(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  // Indonesian thousands separators are dots, so they are stripped, not parsed.
  // A comma is the decimal separator here and money in this system has no
  // decimal part -- refusing is honest, rounding would invent a number.
  const digits = trimmed.replace(/\./g, '').replace(/\s/g, '')
  if (!/^\d+$/.test(digits)) return null

  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

/** The unit as a juragan reads it, for "Rp 350.000 / hari". */
const UNIT_LABEL: Record<string, string> = {
  hour: 'jam',
  day: 'hari',
  week: 'minggu',
  month: 'bulan',
}

/**
 * `(350000, 'day')` → `"Rp 350.000 / hari"`.
 *
 * The unit is shown and never asked: phase 1 presets have exactly one, so a
 * picker would be a question that only exists for a vertical nobody opened yet
 * (BR-017).
 */
export function formatPrice(value: number, pricingUnit: string): string {
  return `${formatRupiah(value)} / ${UNIT_LABEL[pricingUnit] ?? pricingUnit}`
}
