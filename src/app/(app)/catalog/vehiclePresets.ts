import type { components } from 'lib/api/schema'

type VehicleType = components['schemas']['VehicleType']
type Transmission = components['schemas']['Transmission']
type Fuel = components['schemas']['Fuel']

/**
 * Konstanta per jenis kendaraan.  (S1-087, BR-094)
 *
 * Di kode, bukan di database, dan alasannya sudah tertulis di BR-017 aturan 4:
 * ini konfigurasi produk, bukan data tenant. Dua jenis kendaraan harus punya
 * satu sumber kebenaran, bukan satu per pemilik.
 *
 * Halaman publik (`S1-060`) belum ada. Kalau nanti ia butuh teks yang sama, ia
 * menyalinnya atau kita pindahkan ke API waktu itu — sesudah tahu bentuknya
 * dibutuhkan, bukan sebelum.
 */

export const VEHICLE_TYPES: { value: VehicleType; label: string; hint: string }[] = [
  { value: 'car', label: 'Mobil', hint: 'Avanza, Innova, Brio' },
  { value: 'motorcycle', label: 'Motor', hint: 'Vario, NMAX, Beat' },
]

/**
 * Transmisi per jenis. `clutch` (kopling) **hanya ada di motor** — ditegakkan
 * database, dan disembunyikan di sini supaya juragan tidak pernah memilih
 * sesuatu yang akan ditolak.
 */
export const TRANSMISSIONS: Record<VehicleType, { value: Transmission; label: string }[]> = {
  car: [
    { value: 'manual', label: 'Manual' },
    { value: 'automatic', label: 'Matic' },
  ],
  motorcycle: [
    { value: 'automatic', label: 'Matic' },
    { value: 'manual', label: 'Bebek' },
    { value: 'clutch', label: 'Kopling' },
  ],
}

/** `diesel` **hanya ada di mobil**, alasan yang sama dengan `clutch`. */
export const FUELS: Record<VehicleType, { value: Fuel; label: string }[]> = {
  car: [
    { value: 'gasoline', label: 'Bensin' },
    { value: 'diesel', label: 'Solar' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'electric', label: 'Listrik' },
  ],
  motorcycle: [
    { value: 'gasoline', label: 'Bensin' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'electric', label: 'Listrik' },
  ],
}

/**
 * Placeholder yang diawali "Contoh: ", dan tombol "Pakai contoh" menyalinnya
 * jadi isi sungguhan. Juragan tinggal mengganti angkanya.
 *
 * Isinya sengaja spesifik sampai ke nominal antar-jemput: contoh yang terlalu
 * umum ("tulis syarat sewa Anda") tidak menghemat pekerjaan siapa pun.
 */
export const PLACEHOLDERS: Record<VehicleType, Record<string, string>> = {
  car: {
    description:
      'Contoh: AC dingin, charger HP, audio Bluetooth, kartu e-Toll (saldo isi sendiri), air mineral gratis. Ban serep & dongkrak tersedia.',
    terms_excludes:
      'Contoh: Harga belum termasuk BBM, tol, dan parkir. BBM dikembalikan sama seperti saat diambil.',
    terms_requirements:
      'Contoh: KTP & SIM A asli penyewa. KTP asli ditinggal sebagai jaminan. Usia minimal 21 tahun. Boleh ke luar kota dengan izin. Antar-jemput dalam kota Rp 50.000.',
    terms_cancellation:
      'Contoh: Batal H-3 refund 100%, H-1 refund 50%, hari-H tanpa refund. Reschedule gratis 1× paling lambat H-1, selama unit tersedia.',
  },
  motorcycle: {
    description:
      'Contoh: 2 helm SNI, 2 jas hujan, holder HP, charger USB, box bagasi.',
    terms_excludes:
      'Contoh: Harga belum termasuk BBM dan parkir. BBM dikembalikan sama seperti saat diambil.',
    terms_requirements:
      'Contoh: KTP & SIM C asli penyewa. KTP asli ditinggal sebagai jaminan. Hanya dalam kota. Antar-jemput Rp 20.000.',
    terms_cancellation:
      'Contoh: Batal H-3 refund 100%, H-1 refund 50%, hari-H tanpa refund. Reschedule gratis 1× paling lambat H-1, selama unit tersedia.',
  },
}

/** Warna yang cukup sering dipakai untuk jadi pilihan; sisanya diketik. */
export const COLORS = ['Putih', 'Hitam', 'Silver', 'Abu-abu', 'Merah', 'Biru', 'Kuning']

/** 1990 sampai tahun depan — batas atas yang tidak bisa jadi CHECK (BR-094). */
export function modelYears(): number[] {
  const max = new Date().getFullYear() + 1
  const years: number[] = []
  for (let y = max; y >= 1990; y--) years.push(y)
  return years
}
