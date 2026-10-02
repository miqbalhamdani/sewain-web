export const INVOICE_STATUS: Record<string, { label: string; scheme: string }> = {
  unpaid: { label: 'belum bayar', scheme: 'orange' },
  gateway_pending: { label: 'menunggu', scheme: 'gray' },
  paid: { label: 'lunas', scheme: 'green' },
  overdue: { label: 'lewat tenggat', scheme: 'red' },
  cancelled: { label: 'batal', scheme: 'gray' },
}
