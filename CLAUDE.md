# sewain-web — admin Next.js, halaman publik, portal penyewa

Fase 1 · Rental & sewa. Next.js 15 App Router · TypeScript · TanStack Query + Table.

**Dua sistem styling, satu repo, dan batasnya sama dengan batas autentikasi:**

| Permukaan | Styling |
|---|---|
| `(auth)` + `(app)` — backoffice | **Chakra UI** — kerangka & komponen dari [Horizon UI Chakra NextJS](https://github.com/horizon-ui/horizon-ui-chakra-nextjs) (MIT, lihat `LICENSE`) |
| `r/[slug]` + `b/[token]` — publik | **Tailwind** — tanpa Chakra, tanpa CSS global Horizon |

`ChakraProvider` tinggal di `src/app/admin/layout.tsx` dan `src/app/auth/layout.tsx`, **bukan** di
`src/app/layout.tsx`. Root layout sengaja kosong — hanya `<html><body>` — supaya halaman publik
tidak mewarisi Chakra maupun `styles/App.css`. Kalau kamu memindahkan provider ke root, halaman
yang dibuka penyewa di jaringan seluler ikut mengunduh seluruh Chakra + emotion.

**Tailwind belum dipasang.** Ia masuk bareng halaman publik pertama, diimpor **hanya** dari layout
subtree publik — jangan dari root. Preflight Tailwind yang bocor ke root akan me-reset tipografi
seluruh backoffice Chakra.

Layar referensi Horizon yang masih ada — `admin/default`, `admin/data-tables`, `admin/profile`,
`auth/sign-in` — adalah contoh pola, bukan layar produk. Ganti, jangan tumpuk.

**Kontraknya ada di `../docs/`.** Klien API **digenerate** dari `../docs/openapi.yaml` — tidak
pernah ditulis tangan, tidak pernah diedit. Kalau endpoint yang kamu butuh belum ada, itu PR
kontrak, bukan panggilan `fetch`.

`../docs/product-requirements.md` §5 (user story + acceptance criteria) adalah definisi selesai
untuk setiap layar. `../docs/business-rules.md` adalah alasannya. Baca yang relevan sebelum
membangun satu layar.

Backlog fase ini: [`../docs/BACKLOG.md`](../docs/BACKLOG.md) — **satu backlog untuk dua repo**,
berurut `S1-001`–`S1-070`.

**Frontend tidak menunggu backend.** Begitu `S1-002` (`openapi.yaml`) ada, layar boleh dibangun di
atas klien yang digenerate kapan saja — kolom `Depends` menandai kapan sebuah layar bisa
**diverifikasi**, bukan kapan boleh mulai ditulis. Yang tetap berlaku: sebuah milestone belum
selesai selama layarnya belum selesai.

---

## Perintah

Yang sudah jalan hari ini:

```bash
npm run dev        # localhost:3000, mengharapkan API di :8080
npm run build
npm run start
npm run lint
npm run typecheck  # tsc --noEmit
```

Yang **belum ada** dan siapa yang membawanya:

| Perintah | Isi | Datang bareng |
|---|---|---|
| `npm run generate` | openapi-typescript → `src/lib/api/schema.d.ts`, no-op di tree bersih | `S1-002` (`../docs/openapi.yaml`) |
| `npm run test` | vitest + testing-library | setup tooling test |
| `npm run e2e` | playwright | setup tooling test |
| `npm run check` | generate + lint + typecheck + test — jalankan sebelum tiap PR | setelah tiga di atas ada |

Jangan menulis layar yang memanggil `npm run generate` sebelum `S1-002` merge. `@testing-library/*`
dan `@types/jest` sudah nangkring di `dependencies` warisan template — biarkan sampai runner test
yang sebenarnya masuk, lalu pindahkan ke `devDependencies` sekalian.

---

## Tiga permukaan, satu aplikasi

```
src/app/
  (auth)/login/          tanpa shell
  (app)/                 backoffice: sidebar, header, guard peran
    dashboard/
    calendar/            kalender ketersediaan — layar paling sering dibuka juragan
    bookings/
    catalog/
    customers/
    invoices/
    reports/             owner saja
    settings/
  r/[slug]/              HALAMAN PUBLIK — tanpa auth, tanpa shell backoffice
  b/[token]/             PORTAL PENYEWA — tanpa akun, akses lewat link WhatsApp
```

**Route group memikul batas autentikasi.** `(auth)` render polos; `(app)` render shell dan
mengalihkan pengunjung anonim ke `/login`; `r/[slug]` dan `b/[token]` **tidak pernah** mengimpor
apa pun dari `(app)` — bukan sidebar, bukan hook sesi, bukan komponen yang membaca `/me`.

Satu impor yang salah dari backoffice ke halaman publik adalah cara data pemilik bocor ke
halaman yang bisa dibuka siapa saja. Kalau sebuah komponen dipakai di dua sisi, ia pindah ke
`src/components/shared/` dan tidak boleh menyentuh sesi.

---

## Halaman publik `/r/[slug]` (BR-025, BR-030)

Satu backoffice, satu API, banyak halaman pemilik. Halaman ini bukan aplikasi terpisah dan bukan
salinan data — ia tampilan dari data yang sama yang diisi pemilik di backoffice.

- **Ketersediaan tidak boleh di-cache.** `export const dynamic = "force-dynamic"` pada route
  ketersediaan; tidak ada ISR, tidak ada `revalidate`. Katalog yang basi 60 detik adalah katalog
  yang menjual unit yang barusan dibooking. Metadata & foto boleh statis.
- **Yang tidak pernah dirender:** kode/plat unit, id unit, nama penyewa lain, harga khusus,
  `owner_id`. Kalau data itu ada di respons, itu bug backend — laporkan, jangan sembunyikan di
  komponen.
- **Ketersediaan tampil di level resource** ("tersisa 2 unit"), bukan per unit.
- Pengajuan menghasilkan `draft` yang **belum mengunci apa pun**. Salinannya harus jujur:
  "Pengajuan terkirim, menunggu konfirmasi pemilik" — bukan "Booking berhasil". Penyewa yang
  mengira sudah dapat unit lalu ditolak adalah kegagalan yang lebih mahal daripada tidak jadi
  mengajukan (BR-026).
- Slug asing → `notFound()`. Tidak ada halaman "rental tidak ditemukan" yang membedakan diri dari
  "rental nonaktif".

---

## Portal penyewa `/b/[token]` (BR-002)

Tanpa akun, tanpa install. Memuat jadwal, rincian tagihan, foto kondisi milik booking itu, dan
status deposit. Tidak memuat booking lain, katalog, maupun laporan.

Token ada di URL. Jangan pernah menaruhnya di `localStorage`, di query analytics, atau di
`document.title`.

---

## Peran (BR-003)

Baca izin dari `/me` dan **jangan render** aksi yang tidak dimiliki pengguna. Tombol nonaktif yang
tetap `403` lebih buruk daripada tombol yang tidak ada: ia mengiklankan kemampuan yang tidak ada
dan melahirkan pertanyaan ke support.

`operator` **tidak** melihat: navigasi Laporan, angka pemasukan di dashboard, field harga & deposit
di editor resource, aksi hapus apa pun, pengaturan langganan.

---

## Data & form

### Tiga aturan yang paling sering jadi bug

1. **Menghilangkan field ≠ mengirim `null`.** Key yang absen memakai default server; `null`
   eksplisit adalah `422`. Buang field opsional yang kosong sebelum submit.
2. **Jangan pernah kirim field yang dikelola server**: `id`, `owner_id`, `code`,
   `end_at_with_buffer`, `unit_price`, `deposit_amount`, `late_fee_per_unit`, `actual_return_at`.
   Harga **di-snapshot server** saat booking dibuat; mengirimnya dari klien ditolak `400`.
3. **`409 booking-conflict` tidak pernah di-retry otomatis.** Tampilkan booking yang bentrok dari
   array `conflicts`, dan minta pengguna memilih tanggal atau unit lain.

### Uang

`350000` berarti **Rp 350.000**. Rupiah penuh, bukan minor unit.

> **Ini beda dari `new-commerce-web`,** yang memakai minor unit (`19900000` = Rp 199.000). Jangan
> salin `lib/format/money` dari sana tanpa membuang pembagian 100-nya. Salah arah sekali saja
> menghasilkan tagihan 100× — dan tagihannya benar-benar terkirim ke penyewa.

Format lewat `lib/format/money`. Jangan pernah `parseFloat` pada input pengguna; parse ke integer
di batas input dan pertahankan integral sampai ke API.

### Waktu

API memakai UTC; tampilan memakai Asia/Jakarta lewat `lib/format/datetime`. Rentang bersifat
**awal inklusif, akhir eksklusif** di seluruh sistem — sewa "3–5 Sep" berakhir pada 5 Sep jam
mulai, dan UI harus mengatakannya begitu, bukan menampilkan "sampai 4 Sep" hasil kurang satu hari.

### Error

RFC 9457 `application/problem+json`. Tampilkan `detail`, dan jaga `trace_id` tetap bisa disalin.

| `type` | UI |
|---|---|
| `booking-conflict` | Daftar booking yang bentrok + aksi pilih tanggal/unit lain |
| `customer-blacklisted` | Peringatan berisi alasan — **hanya di backoffice**, tidak pernah di halaman publik |
| `payment-required-before-pickup` | Arahkan ke invoice, bukan sekadar menolak |
| `physical-conflict-unconfirmed` | Dialog konfirmasi eksplisit, bukan toast |
| `handover-photo-required` | Field-level pada area unggah foto |
| `deposit-not-settled` | Arahkan ke layar penyelesaian deposit |
| `unit-quota-exceeded` | Ajakan naik paket, bukan pesan error mentah |
| `rate-limited` | Halaman publik: minta coba lagi beberapa menit; jangan auto-retry |

---

## Serah-terima: satu tangan, di HP, di parkiran

Ini alur yang paling sering dipakai dan paling sering dipakai dalam kondisi terburuk — sambil
berdiri, sambil dilihat penyewa, sinyal seadanya. Target: **selesai < 3 menit** (PRD §10).

- Target sentuh minimal 44px. Aksi utama dalam jangkauan ibu jari, di bawah layar.
- Kamera dibuka langsung dari alur (`capture="environment"`), bukan lewat file picker.
- Unggah berjalan **di latar** dengan progres nyata; form tidak pernah diblokir menunggunya.
  Foto 5MB di jaringan seluler Indonesia itu lambat dan operator harus tetap bisa mengetik.
- Foto wajib minimal 1 dan itu ditegakkan server (`422`). UI menampilkannya sebagai syarat sejak
  awal, bukan sebagai kejutan saat submit.
- Denda telat **ditampilkan sebelum dikonfirmasi**, dengan jalur membebaskan sebagian/seluruhnya
  beserta alasannya. Jangan sembunyikan tombol bebaskan (BR-046).

**Tidak ada dukungan offline** (PRD §9). Jangan bikin antrean submit optimistis, jangan simpan
draft serah-terima di IndexedDB untuk dikirim nanti. Sinkronisasi offline pada data yang justru
butuh cek bentrok real-time adalah cara tercepat menciptakan double-booking yang mau dihindari.
Yang benar: tampilkan status koneksi dan biarkan operator menunggu.

---

## Unggah foto

Lewat API, bukan langsung ke object storage: `multipart/form-data` ke endpoint serah-terima, API
yang menaruh ke MinIO. Foto bukti adalah barang bukti — API yang menuliskannya sekaligus mencatat
barisnya dalam satu transaksi (BR-036, BR-037).

Setelah tersimpan, foto **tidak bisa dihapus atau diganti** dari UI mana pun. Jangan render tombol
hapus pada foto handover, termasuk untuk peran `owner`.

---

## Server vs client component

**Server Component adalah default.** `"use client"` hanya ketika butuh state, effect, atau event
handler.

- Kalender ketersediaan dan daftar booking di-render server. Target pencarian < 1 detik untuk
  500 unit × 12 bulan tidak tercapai lewat air terjun fetch di klien.
- Client component: grid kalender interaktif, form booking, alur serah-terima, unggah foto.
- Jangan pernah fetch di `useEffect` untuk data yang bisa dirender server.

---

## Jangan pernah

- Edit `src/lib/api/schema.d.ts`. Itu generated. Ubah kontraknya.
- Panggil `fetch` langsung ke API. Pakai klien yang digenerate.
- Simpan access token di `localStorage`. Ia tinggal di memori; refresh token adalah cookie httpOnly.
- Impor apa pun dari `(app)/` di dalam `r/[slug]/` atau `b/[token]/`.
- Impor Chakra, `theme/`, `components/` Horizon, atau `styles/App.css` di dalam `r/[slug]/` atau
  `b/[token]/`. Batas styling berjalan di garis yang sama dengan batas autentikasi.
- Menaruh `ChakraProvider` atau CSS global Horizon di `src/app/layout.tsx`.
- Cache atau `revalidate` data ketersediaan di halaman publik.
- Kirim `null` untuk field opsional yang dikosongkan pengguna.
- Retry `409` secara otomatis.
- Render tombol hapus/ubah pada baris atau foto serah-terima.
- Menampilkan alasan blacklist di permukaan publik.
- Hardcode simbol mata uang, format tanggal, atau zona waktu. Pakai `lib/format`.
- Menandai tagihan lunas di UI setelah kembali dari halaman gateway. Redirect bukan bukti —
  tunggu status dari server (BR-064).

`localStorage` boleh untuk kenyamanan ringan per pengguna — filter yang diingat, kolom yang
disembunyikan, sidebar yang terlipat. Bungkus baca/tulisnya dengan `try/catch` dan render dengan
benar saat kosong.

---

## Penjaga ruang lingkup fase 1

Tidak ada: layar stok, multi-cabang, kalender per jam, jadwal berulang mingguan, tanda tangan
digital, app native, direktori publik lintas pemilik.

Kalau sebuah desain menampilkannya, desainnya mendahului backlog. `../docs/BACKLOG.md` §Di luar ruang
lingkup punya tabelnya beserta fasenya.
