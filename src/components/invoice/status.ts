export const INVOICE_STATUS: Record<string, { label: string; scheme: string }> = {
  unpaid: { label: 'belum bayar', scheme: 'orange' },
  gateway_pending: { label: 'menunggu', scheme: 'gray' },
  paid: { label: 'lunas', scheme: 'green' },
  overdue: { label: 'lewat tenggat', scheme: 'red' },
  cancelled: { label: 'batal', scheme: 'gray' },
}

/** `kind` baris sebagaimana juragan membacanya; `discount` sengaja tak disebut. */
export const KIND_LABEL: Record<string, string> = {
  rent: 'Sewa',
  deposit: 'Deposit',
  late_fee: 'Denda telat',
  damage: 'Kerusakan',
}

/** "Sewa + Deposit" dari baris-baris sebuah invoice -- label unik, urut muncul. */
export function invoicePurpose(lines: { kind: string }[]): string {
  return [...new Set(lines.map((l) => KIND_LABEL[l.kind]).filter(Boolean))].join(' + ')
}
