import type { components } from 'lib/api/schema'

type Booking = components['schemas']['Booking']

export type StepAction = 'confirm' | 'pay' | 'review' | 'pickup' | 'return' | 'settle' | 'complete'

export type Step = {
  action: StepAction
  /** Teks tombol, kata kerja. */
  label: string
  /** Satu-dua kalimat biasa yang menyebut angkanya. */
  hint: string
  /**
   * Id elemen yang dituju, untuk langkah yang bukan request (`pay`, `review`,
   * `settle`): tombolnya menggulir ke sana, karena tombol sebenarnya ada di
   * kartunya -- catat bayar butuh memilih invoice, tinjau bukti butuh melihat
   * gambarnya, selesaikan deposit butuh catatan potongan.
   */
  anchor?: string
}

/** Yang tidak ada di objek Booking tapi menentukan langkahnya. */
export type StepExtra = {
  deposit?: StepDeposit
  /** Bukti transfer dari penyewa yang masih `pending`, di invoice yang belum lunas. */
  pendingProofs?: number
  /** Invoice pertama yang punya bukti menunggu; tujuan anchor `review`. */
  pendingProofInvoiceId?: string | null
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
export function nextStep(b: StepInput, extra: StepExtra, fmt: (n: number) => string): Step | null {
  const { deposit, pendingProofs = 0, pendingProofInvoiceId = null } = extra
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
      if (belumLunas && pendingProofs > 0) {
        // Uangnya mungkin sudah masuk: bukti dari penyewa ditinjau SEBELUM
        // operator mencatat pembayaran lain, atau penyewa ditagih dua kali.
        return {
          action: 'review',
          label: 'Periksa bukti transfer',
          anchor: pendingProofInvoiceId ? `bukti-${pendingProofInvoiceId}` : 'tagihan',
          hint: `${awal}Penyewa sudah mengirim bukti transfer. Cocokkan nominal dan tanggalnya dengan tagihan ${fmt(b.payment.outstanding)}, lalu setujui atau tolak. Catat pembayaran tunai atau transfer hanya kalau penyewa membayar dengan cara lain.`,
        }
      }
      if (belumLunas) {
        return {
          action: 'pay',
          label: 'Catat pembayaran',
          anchor: 'tagihan',
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
        if (b.payment.outstanding > 0) {
          // Sesudah settle, kekurangannya adalah invoice baru (BR-048). Menutup
          // booking dengan tagihan terbuka sah, tapi bukan urutan yang disarankan.
          return {
            action: 'pay',
            label: 'Catat pembayaran kekurangan',
            anchor: 'tagihan',
            hint: `Unit sudah kembali, tapi masih ada tagihan ${fmt(b.payment.outstanding)} yang belum dibayar. Catat pembayarannya di bagian Tagihan, lalu tutup booking.`,
          }
        }
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
          anchor: 'tagihan',
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
      return { action: 'settle', label: 'Selesaikan deposit', anchor: 'deposit', hint }
    }

    case 'completed':
      if (b.payment.outstanding > 0) {
        return {
          action: 'pay',
          label: 'Catat pembayaran sisa',
          anchor: 'tagihan',
          hint: `Booking sudah selesai, tapi sisa tagihan ${fmt(b.payment.outstanding)} belum dibayar.`,
        }
      }
      return null

    default:
      return null
  }
}

export type PlanState = 'done' | 'current' | 'upcoming'

export type PlanItem = {
  key: string
  /** Nama langkahnya, frasa benda -- tombolnya yang memakai kata kerja. */
  label: string
  state: PlanState
  /** Hanya pada langkah `current`: `hint` dari `nextStep`. */
  note?: string
}

/**
 * Urutan kerja satu booking dari awal sampai tutup, dengan posisi hari ini.
 *
 * `nextStep` menjawab "apa yang harus kulakukan sekarang"; daftar ini menjawab
 * "aku ada di mana, dan apa yang menyusul" -- operator baru di booking yang
 * sudah kembali tidak tahu bahwa sesudah deposit masih ada kekurangan yang
 * harus dicatat, lalu booking ditutup. Langkah yang sedang berjalan membawa
 * kalimat `hint`-nya; yang lain cuma nama.
 *
 * Booking batal tidak punya urutan: kartu penutup yang bicara.
 */
export function stepPlan(b: StepInput, extra: StepExtra, fmt: (n: number) => string): PlanItem[] {
  if (b.status === 'cancelled') return []
  const kini = nextStep(b, extra, fmt)
  const lewatAmbil = b.status === 'picked_up' || b.status === 'returned' || b.status === 'completed'
  const lewatKembali = b.status === 'returned' || b.status === 'completed'
  const lunas = b.payment.status === 'paid'
  const sisa = b.payment.outstanding
  const depositBeres = b.deposit_settled_at !== null || b.deposit_waived_at !== null
  const depositMenunggu = b.deposit_amount !== null && !depositBeres

  // `pay` muncul di tiga tempat berbeda; item mana yang ia tempati bergantung
  // pada sampai mana bookingnya: sebelum ambil itu pembayaran sewa, sesudah
  // kembali itu deposit yang belum dibayar, atau kekurangan sesudah deposit.
  const aktif: string | null = kini === null ? null
    : kini.action === 'confirm' ? 'konfirmasi'
    : kini.action === 'pickup' ? 'ambil'
    : kini.action === 'return' ? 'kembali'
    : kini.action === 'settle' ? 'deposit'
    : kini.action === 'complete' ? 'selesai'
    : !lewatAmbil ? 'bayar'
    : depositMenunggu ? 'deposit'
    : 'kekurangan'

  const item = (key: string, label: string, done: boolean): PlanItem =>
    key === aktif
      ? { key, label, state: 'current', note: kini?.hint }
      : { key, label, state: done ? 'done' : 'upcoming' }

  const items: PlanItem[] = []
  if (b.status === 'draft') items.push(item('konfirmasi', 'Konfirmasi booking', false))

  // Sesudah kembali, urusan sewanya dianggap lewat: sisa yang masih terbuka
  // adalah urusan deposit atau kekurangan, dan itu item di bawah.
  const bayarBeres = lunas || lewatKembali
  items.push(item('bayar',
    lunas ? 'Pembayaran lunas' : sisa > 0 && !bayarBeres ? `Pembayaran — sisa ${fmt(sisa)}` : 'Pembayaran sewa',
    bayarBeres))
  items.push(item('ambil', 'Serah-terima ambil', lewatAmbil))
  items.push(item('kembali', 'Terima kembali', lewatKembali))

  if (b.deposit_amount !== null) {
    items.push(item('deposit',
      b.deposit_waived_at !== null ? 'Deposit dibebaskan' : b.deposit_settled_at !== null ? 'Deposit diselesaikan' : 'Selesaikan deposit',
      depositBeres))
  }

  if (aktif === 'kekurangan' && kini) {
    items.push(item('kekurangan', `${kini.label} ${fmt(sisa)}`, false))
  } else if (aktif === 'deposit' && extra.deposit && extra.deposit.new_invoice_amount > 0) {
    // BR-048: potongan melebihi deposit, kekurangannya terbit sebagai invoice
    // baru saat settle -- jadi sudah bisa dijanjikan sebagai langkah berikutnya.
    items.push(item('kekurangan', `Catat pembayaran kekurangan ${fmt(extra.deposit.new_invoice_amount)}`, false))
  }

  items.push(item('selesai', b.status === 'completed' ? 'Booking selesai' : 'Selesaikan booking', b.status === 'completed'))
  return items
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
