import type { components } from 'lib/api/schema'

type Booking = components['schemas']['Booking']

export type StepAction = 'confirm' | 'pay' | 'pickup' | 'return' | 'settle' | 'complete'

export type Step = {
  action: StepAction
  /** Teks tombol, kata kerja. */
  label: string
  /** Satu-dua kalimat biasa yang menyebut angkanya. */
  hint: string
}

export type StepInput = Pick<
  Booking,
  'status' | 'overdue' | 'payment' | 'deposit_amount' | 'deposit_waived_at' | 'deposit_settled_at'
>

export type ClosingInput = Pick<
  Booking,
  'status' | 'cancelled_reason' | 'payment' | 'deposit_amount' | 'deposit_refunded' | 'deposit_deducted'
>

export type ClosingNote = {
  tone: 'danger' | 'success'
  title: string
  text: string
}

/** Potongan `GET /bookings/{id}/deposit` yang dibutuhkan kalimatnya. */
export type StepDeposit = {
  collected: boolean
  deductions: number
  refund_amount: number
  new_invoice_amount: number
}

/**
 * Langkah berikutnya untuk satu booking, dari statusnya.  (S1-029)
 *
 * Fungsi murni tanpa import runtime, supaya `nextStep.check.mjs` bisa
 * menjalankannya langsung di Node -- repo ini belum punya runner test.
 * `fmt` memformat rupiah; pemanggil memberi `formatRupiah`.
 *
 * `pay` dan `settle` bukan request: keduanya menggulir ke kartu Tagihan atau
 * Deposit, tempat tombol sebenarnya berada -- catat bayar butuh memilih
 * invoice dan cara bayar, selesaikan deposit butuh catatan potongan.
 */
export function nextStep(b: StepInput, deposit: StepDeposit | undefined, fmt: (n: number) => string): Step | null {
  const belumLunas = b.payment.status === 'unpaid' || b.payment.status === 'overdue'

  switch (b.status) {
    case 'draft':
      return {
        action: 'confirm',
        label: 'Konfirmasi booking',
        hint: 'Draft dari halaman publik belum mengunci unit. Konfirmasi untuk memesannya — kalau unitnya sudah terpakai, sistem akan memberi tahu.',
      }

    case 'reserved':
    case 'no_show': {
      // BR-057: tidak datang tidak langsung ditolak; yang telat tetap dilayani.
      const awal = b.status === 'no_show' ? 'Penyewa belum datang di jam mulai, tapi kalau datang tetap bisa dilayani. ' : ''
      if (belumLunas) {
        return {
          action: 'pay',
          label: 'Catat pembayaran',
          hint: `${awal}Sisa tagihan ${fmt(b.payment.outstanding)} belum dibayar. Catat pembayarannya di bagian Tagihan.`,
        }
      }
      return {
        action: 'pickup',
        label: 'Serah-terima ambil',
        hint: `${awal}Sewa sudah lunas. Saat penyewa datang, foto kondisi unit lalu serahkan.`,
      }
    }

    case 'picked_up':
      return {
        action: 'return',
        label: 'Terima kembali',
        hint: b.overdue
          ? 'Unit sudah lewat jadwal kembali. Saat unit tiba, foto kondisinya — denda telat akan diusulkan otomatis.'
          : 'Unit sedang disewa. Saat kembali, foto kondisinya lalu terima.',
      }

    case 'returned': {
      const dep = b.deposit_amount
      const depositMenunggu = dep !== null && b.deposit_waived_at === null && b.deposit_settled_at === null
      if (!depositMenunggu) {
        return {
          action: 'complete',
          label: 'Selesaikan booking',
          hint: 'Unit sudah kembali dan tidak ada deposit yang menunggu. Tutup booking ini.',
        }
      }
      if (deposit && !deposit.collected) {
        // Settle menjawab 409 deposit-not-collected; arahkan ke tagihannya dulu.
        return {
          action: 'pay',
          label: 'Catat pembayaran deposit',
          hint: `Deposit ${fmt(dep)} belum pernah dibayar, jadi belum bisa diselesaikan. Catat pembayarannya di bagian Tagihan, atau bebaskan.`,
        }
      }
      let hint = `Deposit ${fmt(dep)} menunggu diselesaikan.`
      if (deposit) {
        if (deposit.deductions === 0) {
          hint = `Tidak ada potongan. Deposit ${fmt(dep)} dikembalikan penuh ke penyewa.`
        } else if (deposit.new_invoice_amount > 0) {
          // BR-048: kekurangannya jadi invoice baru, bukan deposit minus.
          hint = `Potongan ${fmt(deposit.deductions)} lebih besar dari deposit ${fmt(dep)}. Invoice baru ${fmt(deposit.new_invoice_amount)} akan terbit untuk sisanya.`
        } else {
          hint = `Potongan ${fmt(deposit.deductions)} diambil dari deposit ${fmt(dep)}; ${fmt(deposit.refund_amount)} dikembalikan ke penyewa.`
        }
      }
      return { action: 'settle', label: 'Selesaikan deposit', hint }
    }

    case 'completed':
      if (b.payment.outstanding > 0) {
        return {
          action: 'pay',
          label: 'Catat pembayaran sisa',
          hint: `Booking sudah selesai, tapi sisa tagihan ${fmt(b.payment.outstanding)} belum dibayar.`,
        }
      }
      return null

    default:
      return null
  }
}

/**
 * Kartu penutup untuk booking yang urusannya sudah selesai -- mengisi slot
 * kartu langkah ketika `nextStep` mengembalikan null.
 *
 * Badge kecil saja tidak cukup untuk mengatakan "batal": keadaan terminal
 * butuh satu kalimat yang menyebut kenapa, dan apa yang sudah terjadi pada
 * unit dan tagihannya (BR-057: booking batal tidak menagih apa pun).
 */
export function closingNote(b: ClosingInput, fmt: (n: number) => string): ClosingNote | null {
  if (b.status === 'cancelled') {
    switch (b.cancelled_reason) {
      case 'expired':
        return {
          tone: 'danger',
          title: 'Draft hangus',
          text: 'Tidak dikonfirmasi sampai batas waktunya, jadi hangus sendiri. Unit tidak pernah terkunci.',
        }
      case 'payment_expired':
        return {
          tone: 'danger',
          title: 'Booking dibatalkan',
          text: 'Dibatalkan otomatis karena pembayaran tidak masuk sampai tenggat. Unitnya sudah bebas, dan tagihan yang belum dibayar ikut dibatalkan.',
        }
      default:
        return {
          tone: 'danger',
          title: 'Booking dibatalkan',
          text: 'Dibatalkan oleh petugas. Unitnya sudah bebas untuk booking lain, dan tagihan yang belum dibayar ikut dibatalkan.',
        }
    }
  }
  if (b.status === 'completed' && b.payment.outstanding === 0) {
    let text = 'Unit sudah kembali dan semua tagihan lunas.'
    if (b.deposit_amount !== null) {
      if (b.deposit_deducted > 0) text += ` ${fmt(b.deposit_deducted)} dipotong dari deposit.`
      if (b.deposit_refunded > 0) text += ` Deposit ${fmt(b.deposit_refunded)} dikembalikan ke penyewa.`
    }
    return { tone: 'success', title: 'Booking selesai', text }
  }
  return null
}
