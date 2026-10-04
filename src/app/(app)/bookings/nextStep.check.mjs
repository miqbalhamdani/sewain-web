// Pengecekan nextStep tanpa runner: repo ini belum punya vitest/jest.
//   node --experimental-strip-types --test "src/app/(app)/bookings/nextStep.check.mjs"
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { closingNote, nextStep } from './nextStep.ts'

const fmt = (n) => `Rp ${n}`
const dasar = {
  overdue: false,
  payment: { status: 'none', outstanding: 0 },
  cancelled_reason: null,
  deposit_amount: null,
  deposit_waived_at: null,
  deposit_settled_at: null,
  deposit_refunded: 0,
  deposit_deducted: 0,
}
const b = (over) => ({ ...dasar, ...over })
const lunas = { status: 'paid', outstanding: 0 }
const belum = (n) => ({ status: 'unpaid', outstanding: n })

test('satu langkah per status', () => {
  assert.equal(nextStep(b({ status: 'draft' }), {}, fmt).action, 'confirm')
  assert.equal(nextStep(b({ status: 'reserved', payment: belum(100) }), {}, fmt).action, 'pay')
  assert.equal(nextStep(b({ status: 'reserved', payment: lunas }), {}, fmt).action, 'pickup')
  assert.equal(nextStep(b({ status: 'no_show', payment: { status: 'overdue', outstanding: 80 } }), {}, fmt).action, 'pay')
  assert.match(nextStep(b({ status: 'no_show', payment: lunas }), {}, fmt).hint, /tetap bisa dilayani/)
  assert.equal(nextStep(b({ status: 'picked_up', overdue: true, payment: lunas }), {}, fmt).action, 'return')
  assert.equal(nextStep(b({ status: 'returned', payment: lunas }), {}, fmt).action, 'complete')
  assert.equal(nextStep(b({ status: 'completed', payment: belum(300) }), {}, fmt).action, 'pay')
  assert.equal(nextStep(b({ status: 'completed', payment: lunas }), {}, fmt), null)
  assert.equal(nextStep(b({ status: 'cancelled' }), {}, fmt), null)
})

test('bukti dari penyewa ditinjau sebelum mencatat pembayaran lain', () => {
  const dipesan = b({ status: 'reserved', payment: belum(1200) })
  const tinjau = nextStep(dipesan, { pendingProofs: 1, pendingProofInvoiceId: 'inv-1' }, fmt)
  assert.equal(tinjau.action, 'review')
  assert.equal(tinjau.anchor, 'bukti-inv-1')
  assert.match(tinjau.hint, /Rp 1200/)
  // Tanpa bukti: kembali ke catat pembayaran, menuju kartu Tagihan.
  const bayar = nextStep(dipesan, { pendingProofs: 0 }, fmt)
  assert.equal(bayar.action, 'pay')
  assert.equal(bayar.anchor, 'tagihan')
  // Sudah lunas: bukti yang tersisa bukan urusan langkah berikutnya.
  assert.equal(nextStep(b({ status: 'reserved', payment: lunas }), { pendingProofs: 1 }, fmt).action, 'pickup')
})

test('deposit yang menunggu menyebut angkanya', () => {
  const kembali = b({ status: 'returned', deposit_amount: 500, payment: belum(600) })
  const kurang = nextStep(kembali, { deposit: { collected: true, deductions: 600, refund_amount: 0, new_invoice_amount: 100 } }, fmt)
  assert.equal(kurang.action, 'settle')
  assert.equal(kurang.anchor, 'deposit')
  assert.match(kurang.hint, /Invoice baru Rp 100/)

  const cukup = nextStep(kembali, { deposit: { collected: true, deductions: 200, refund_amount: 300, new_invoice_amount: 0 } }, fmt)
  assert.match(cukup.hint, /Rp 300 dikembalikan/)

  const utuh = nextStep(kembali, { deposit: { collected: true, deductions: 0, refund_amount: 500, new_invoice_amount: 0 } }, fmt)
  assert.match(utuh.hint, /dikembalikan penuh/)

  // Belum dibayar: settle akan 409, jadi arahnya ke tagihan dulu.
  assert.equal(nextStep(kembali, { deposit: { collected: false, deductions: 0, refund_amount: 0, new_invoice_amount: 0 } }, fmt).action, 'pay')

  // Dibebaskan atau sudah beres: langsung tutup.
  assert.equal(nextStep({ ...kembali, deposit_waived_at: '2026-10-01T00:00:00Z' }, {}, fmt).action, 'complete')
  assert.equal(nextStep({ ...kembali, deposit_settled_at: '2026-10-01T00:00:00Z' }, {}, fmt).action, 'complete')
})

test('kartu penutup hanya untuk yang sudah tertutup', () => {
  assert.match(closingNote(b({ status: 'cancelled', cancelled_reason: 'manual' }), fmt).text, /oleh petugas/)
  assert.match(closingNote(b({ status: 'cancelled', cancelled_reason: 'payment_expired' }), fmt).text, /tidak masuk sampai tenggat/)
  assert.equal(closingNote(b({ status: 'cancelled', cancelled_reason: 'expired' }), fmt).title, 'Draft hangus')

  const selesai = closingNote(b({ status: 'completed', payment: lunas, deposit_amount: 500, deposit_refunded: 500 }), fmt)
  assert.equal(selesai.tone, 'success')
  assert.match(selesai.text, /Deposit Rp 500 dikembalikan/)
  const dipotong = closingNote(b({ status: 'completed', payment: lunas, deposit_amount: 500, deposit_deducted: 500 }), fmt)
  assert.match(dipotong.text, /Rp 500 dipotong/)

  // Masih punya langkah (sisa tagihan) atau belum terminal: bukan urusan kartu ini.
  assert.equal(closingNote(b({ status: 'completed', payment: belum(300) }), fmt), null)
  assert.equal(closingNote(b({ status: 'returned', payment: lunas }), fmt), null)
})
