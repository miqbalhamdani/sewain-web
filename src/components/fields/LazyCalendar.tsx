'use client'

import dynamic from 'next/dynamic'

// Tata letak dasar react-calendar. Sempat HILANG sama sekali waktu berkas ini
// diekstrak: impornya ikut terbuang dari kedua field dan tidak dipasang lagi di
// mana pun, jadi yang tersisa cuma MiniCalendar.css milik widget dasbor --
// navigasinya kehilangan margin, tile-nya jadi 54x34.
import 'react-calendar/dist/Calendar.css'
import 'styles/datepicker.css'

/**
 * `react-calendar` dimuat saat kalendernya pertama kali dibuka.
 *
 * Ia menyeret CSS-nya sendiri dan menambah ~24 kB First Load JS ke layar unit
 * (terukur: 228 -> 252 kB) hanya karena kartu saring yang selalu tampil
 * mengimpornya. Tombolnya ringan; isinya yang berat, dan isinya baru perlu ada
 * sesudah diklik.
 *
 * Pemanggil tetap harus merender ini HANYA saat popover-nya terbuka: Chakra
 * memasang `PopoverContent` lebih awal, jadi tanpa penjaga itu modul ini ikut
 * diminta begitu halaman dimuat.
 */
export const LazyCalendar = dynamic(
  () => import('react-calendar').then((m) => m.default),
  { ssr: false },
)
