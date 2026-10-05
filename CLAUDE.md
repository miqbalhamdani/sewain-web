# sewain-web — admin Next.js, halaman publik, portal penyewa

Fase 1 · Rental & sewa. Next.js 15 App Router · TypeScript · TanStack Query + Table.

**Dua sistem styling, satu repo, dan batasnya sama dengan batas autentikasi:**

| Permukaan | Styling |
|---|---|
| `(auth)` + `(app)` — backoffice | **Chakra UI** — kerangka & komponen dari [Horizon UI Chakra NextJS](https://github.com/horizon-ui/horizon-ui-chakra-nextjs) (MIT, lihat `LICENSE`) |
| `(public)/[slug]/` — publik, di `<slug>.sewain.id` | **Tailwind** — tanpa Chakra, tanpa CSS global Horizon |

`ChakraProvider` tinggal di `src/app/admin/layout.tsx` dan `src/app/auth/layout.tsx`, **bukan** di
`src/app/layout.tsx`. Root layout sengaja kosong — hanya `<html><body>` — supaya halaman publik
tidak mewarisi Chakra maupun `styles/App.css`. Kalau kamu memindahkan provider ke root, halaman
yang dibuka penyewa di jaringan seluler ikut mengunduh seluruh Chakra + emotion.

**Tailwind v4 terpasang sejak M5** (`postcss.config.mjs`), dan satu-satunya stylesheet yang
mengimpornya adalah `(public)/[slug]/public.css`, diimpor **hanya** dari layout subtree publik —
jangan dari root. Preflight Tailwind yang bocor ke root akan me-reset tipografi seluruh backoffice
Chakra. `source(none)` + `@source` di file itu membatasi pemindaiannya ke subtree publik dan
`components/shared/`.

**Lokal:** halaman publik hanya bisa diuji lewat proxy — `make proxy` di `sewain-api` (Caddy di
`http://<slug>.sewain.localhost:8088`, `*.localhost` sudah resolve ke loopback). `PUBLIC_APEX`
dibaca `middleware.ts`, sama dengan API dan Caddy.

Layar referensi Horizon yang masih ada — `admin/default`, `admin/data-tables`, `admin/profile`,
`auth/sign-in` — adalah contoh pola, bukan layar produk. Ganti, jangan tumpuk.

**Kontraknya ada di `../docs/`.** Klien API **digenerate** dari `../docs/openapi.yaml` — tidak
pernah ditulis tangan, tidak pernah diedit. Kalau endpoint yang kamu butuh belum ada, itu PR
kontrak, bukan panggilan `fetch`.

`../docs/01-product-requirements.md` §5 (user story + acceptance criteria) adalah definisi selesai
untuk setiap layar. `../docs/02-business-rules.md` adalah alasannya. Baca yang relevan sebelum
membangun satu layar.

Backlog fase ini: [`../docs/05-backlog.md`](../docs/05-backlog.md) — **satu backlog untuk dua repo**,
berurut `S1-001`–`S1-076`.

**Frontend tidak menunggu backend.** Begitu `S1-002` (`openapi.yaml`) ada, layar boleh dibangun di
atas klien yang digenerate kapan saja — kolom `Depends` menandai kapan sebuah layar bisa
**diverifikasi**, bukan kapan boleh mulai ditulis. Yang tetap berlaku: sebuah milestone belum
selesai selama layarnya belum selesai.

---

## Perintah

Yang sudah jalan hari ini:

```bash
npm run dev            # localhost:3000, mengharapkan API di :8080
npm run build
npm run start
npm run lint
npm run typecheck      # tsc --noEmit
npm run generate       # ../docs/openapi.yaml -> src/lib/api/schema.d.ts
npm run generate:check # gagal kalau hasil generate belum di-commit
npm run e2e            # Playwright -- stack lengkap harus sudah jalan, lihat "E2E" di bawah
```

**`generate` menulis, `generate:check` yang menegakkan.** Yang kedua menjalankan yang pertama lalu
`git diff --exit-code` atas berkas hasilnya — itu terjemahan harafiah dari acceptance `S1-002`,
"no-op di tree bersih". Polanya sama dengan `make generate` + `make generated-diff` di
`sewain-api`, termasuk guard `test -f ../docs/openapi.yaml`: `docs` repo terpisah, dan yang cuma
meng-clone repo ini berhak dapat satu kalimat, bukan stack trace dari generator yang tidak
menemukan masukannya.

Yang **belum ada** dan siapa yang membawanya:

| Perintah | Isi | Datang bareng |
|---|---|---|
| `npm run test` | vitest + testing-library | setup tooling test |
| `npm run check` | generate:check + lint + typecheck + test — jalankan sebelum tiap PR | setelah yang di atas ada |

`@testing-library/*` dan `@types/jest` masih nangkring di `dependencies` warisan template —
biarkan sampai runner test yang sebenarnya masuk, lalu pindahkan ke `devDependencies` sekalian.
`typescript` **sudah** pindah, karena `openapi-typescript` v7 menuntut TS ≥ 5 dan repo ini
tertinggal di 4.9.

### E2E (`S1-070`, `S1-071`)

`e2e/` berisi dua suite Playwright: satu siklus booking penuh lewat backoffice, dan halaman publik
→ draft → konfirmasi (plus subdomain asing dan draft kedaluwarsa). Suite **tidak** menyalakan
server apa pun -- ia menguji stack seperti produksi menyajikannya, semuanya lewat Caddy:
backoffice di `app.<apex>`, halaman publik di `<slug>.<apex>`. CI (`.github/workflows/ci.yml`,
job `e2e`) menyalakan stack itu sendiri; di lokal:

```bash
# sewain-api, masing-masing di terminal sendiri
APP_BASE_URL=http://app.sewain.localhost:8088 REGISTER_PER_HOUR_IP=100 make dev
make worker
make proxy                      # Caddy :8088
# sewain-web
npm run build && npm run start  # produksi: rewrite /api dev mati, Caddy yang merutekan
npm run e2e
```

Yang dibaca suite dari env: `E2E_PROXY_PORT` (8088), `E2E_MAILPIT_URL` (`http://localhost:8025` --
pendaftaran diverifikasi lewat tautan di Mailpit), `E2E_DATABASE_URL` (pemilik skema, untuk
memundurkan `expires_at` satu draft), `E2E_SCHEDULER` (default `go run ./cmd/scheduler -once` di
`E2E_API_DIR=../sewain-api`), `E2E_SLUG`. Setiap run membuat pemilik baru, jadi aman di database
yang sudah berisi.

**Jangan bagi Redis dengan worker lain.** `scheduler -once` menaruh sapuan kedaluwarsa di stream
`jobs`; worker mana pun yang membaca Redis yang sama akan mengambilnya -- termasuk worker dev yang
menunjuk database lain, yang lalu menyapu database **itu**. Stack E2E yang berdampingan dengan
stack dev memakai `REDIS_URL=redis://localhost:6379/1`.

---

## Tiga permukaan, satu aplikasi

```
src/app/
  (auth)/login/          tanpa shell
  (auth)/register/       daftar usaha + pilih jenis usaha (BR-005, BR-017)
  (auth)/verify-email/   dinding verifikasi + kirim ulang (BR-006)
  (app)/                 backoffice: sidebar, header, guard peran
    dashboard/
    calendar/            kalender ketersediaan — layar paling sering dibuka juragan
    bookings/
    catalog/
    customers/
    invoices/
    reports/             owner saja
    settings/
  (public)/[slug]/       HALAMAN PUBLIK + PORTAL PENYEWA — tanpa auth, tanpa shell backoffice
    page.tsx             katalog
    resources/[id]/
    booking/[token]/     portal penyewa — tanpa akun, akses lewat link WhatsApp
middleware.ts            Host → rewrite ke /<slug>/…
```

**Dua guard di `(app)`, berurutan:** pengunjung anonim → `/login`; pengguna yang
`email_verified_at`-nya masih kosong → `/verify-email` (BR-006). Guard kedua berlaku
sebelum seluruh layar produk, bukan sebagian.

```
```

**Slug ada di struktur folder, tapi tidak pernah di URL.** `middleware.ts` membaca `Host`,
memetakan `rentalbudi.sewain.id` → slug `rentalbudi`, lalu me-rewrite `/` menjadi `/rentalbudi`
dan `/booking/abc` menjadi `/rentalbudi/booking/abc`. Pengunjung melihat `rentalbudi.sewain.id/`, bukan
`/rentalbudi`. Di `app.sewain.id` middleware tidak melakukan apa pun dan `admin/` + `auth/`
melayani seperti biasa.

Peta host:

```
app.sewain.id          backoffice   M0–M5   cookie sesi HOST-ONLY, tanpa Domain
<slug>.sewain.id       katalog + portal penyewa   M5
sewain.id              promosi      M7      halaman statis, bukan bagian aplikasi
```

**Route group memikul batas autentikasi.** `(auth)` render polos; `(app)` render shell dan
mengalihkan pengunjung anonim ke `/login`; `(public)/[slug]/` **tidak pernah** mengimpor apa pun
dari `(app)` — bukan sidebar, bukan hook sesi, bukan komponen yang membaca `/me`.

Batas host memperkuat batas impor, tapi tidak menggantikannya: `(public)/` juga **tidak boleh
menyetel cookie apa pun di scope `.sewain.id`**. Cookie di scope domain akan terkirim ke setiap
subdomain pemilik lain, dan itu tepat kebalikan dari alasan backoffice dipindah ke
`app.sewain.id`.

Satu impor yang salah dari backoffice ke halaman publik adalah cara data pemilik bocor ke
halaman yang bisa dibuka siapa saja. Kalau sebuah komponen dipakai di dua sisi, ia pindah ke
`src/components/shared/` dan tidak boleh menyentuh sesi.

---

## Halaman publik `<slug>.sewain.id` (BR-025, BR-030)

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
- Host tak dikenal → `notFound()`. Tidak ada halaman "rental tidak ditemukan" yang membedakan
  diri dari "rental nonaktif".
- **Jangan pernah membaca slug dari query atau dari path yang terlihat pengguna.** Satu-satunya
  sumbernya adalah `Host` di `middleware.ts`. Slug di segmen route adalah hasil rewrite internal,
  bukan input.

---

## Portal penyewa `<slug>.sewain.id/booking/[token]` (BR-002)

Tanpa akun, tanpa install. Memuat jadwal, rincian tagihan, foto kondisi milik booking itu, dan
status deposit. Tidak memuat booking lain, katalog, maupun laporan.

Token ada di URL. Jangan pernah menaruhnya di `localStorage`, di query analytics, atau di
`document.title`.

### Pembayaran di portal: jalur satu arah (`../docs/04-api-spec.md` §3.8.1)

**Jalur gateway nonaktif di fase 1.** Yang dirender di portal:

1. **Instruksi transfer + nomor rekening pemilik.** Penyewa transfer sendiri dari aplikasi banknya.
2. **Tombol unggah bukti transfer** → `POST /portal/bookings/{token}/proofs`. Balasannya `202`;
   pembacaan AI berjalan asinkron dan hasilnya cuma rekomendasi buat operator (BR-062). Jangan
   tampilkan status "lunas" karena buktinya sudah terunggah.
3. **Tidak ada tombol "Bayar sekarang".** Endpoint `payment-link` tidak terdaftar, jadi tombol itu
   akan `404`. Jangan dirender, dan jangan dirender-nonaktif — tombol yang mengiklankan cara bayar
   yang tidak ada melahirkan pertanyaan ke pemilik, bukan pembayaran.

Salinannya harus jujur bahwa pelunasan menunggu konfirmasi pemilik. Penyewa yang mengira sudah
lunas lalu ditagih lagi adalah kegagalan yang lebih mahal daripada satu langkah tambahan.

---

## Sesi & usaha (BR-004)

Satu user milik tepat satu usaha. Tidak ada pengalih, tidak ada usaha "aktif" yang bisa berubah,
dan tidak ada `POST /auth/switch-owner` — kalau ada rancangan yang mengandaikannya, itu
rancangan untuk kontrak yang lama.

- **Nama usaha di header dibaca dari `/me`**, bukan dari access token yang di-decode di klien.
  Token itu untuk server; mem-parsing-nya di browser bikin dua sumber kebenaran yang bisa beda.
- **Peran juga dari `/me`**, sekali per sesi. Satu peran per orang, jadi tidak ada yang perlu
  di-invalidasi di tengah jalan selain saat logout.
- Sesi yang aksesnya dicabut mati dalam **≤ 15 menit** — batasnya TTL access token. Klien tidak
  perlu memburu itu; `401` dari server yang jadi sinyalnya, dan `/auth/refresh` yang gagal
  mengantar ke layar login.

---

## Peran (BR-003)

Baca izin dari `/me` dan **jangan render** aksi yang tidak dimiliki pengguna. Tombol nonaktif yang
tetap `403` lebih buruk daripada tombol yang tidak ada: ia mengiklankan kemampuan yang tidak ada
dan melahirkan pertanyaan ke support.

`operator` **tidak** melihat: navigasi Laporan, angka pemasukan di dashboard, field harga & deposit
di editor resource, aksi hapus apa pun, pengaturan pemilik.

Perhatikan bedanya: operator tidak boleh mengubah **nilai** deposit di editor resource, tapi boleh
**membebaskan penagihannya** pada satu booking (BR-051). Dua hal berbeda, dan yang kedua bukan
pengecualian terhadap BR-003.

---

## Data & form

### Empat aturan yang paling sering jadi bug

1. **Menghilangkan field ≠ mengirim `null`.** Key yang absen memakai default server; `null`
   eksplisit adalah `422`. Buang field opsional yang kosong sebelum submit.

   > **Pengecualiannya empat, dan semuanya di `resources`:** `deposit_amount`,
   > `late_fee_per_unit`, `min_duration`, `max_duration`. Untuk keempatnya `null` adalah
   > nilai yang sah dan bermakna — "aturan ini tidak berlaku" (BR-016) — dan pada `PATCH`
   > ia **satu-satunya cara mencabut** nilai yang sudah ada. Aturan di atas menjaga field
   > yang dikelola server; keempat ini bukan. `04-api-spec.md` §3.2 menulisnya lengkap.
   >
   > `0` **bukan** pengganti `null` di sini. Database menolaknya, dan pesannya menyuruh
   > pengguna mengosongkan field-nya — bukan mengisi angka lain (PRD §5 A1).
2. **Jangan pernah kirim field yang dikelola server**: `id`, `owner_id`, `code`,
   `end_at_with_buffer`, `unit_price`, `pricing_unit`, `deposit_amount`, `late_fee_per_unit`,
   `actual_return_at`.
   Harga **di-snapshot server** saat booking dibuat; mengirimnya dari klien ditolak `400`.
3. **`409 booking-conflict` tidak pernah di-retry otomatis.** Tampilkan booking yang bentrok dari
   array `conflicts`, dan minta pengguna memilih tanggal atau unit lain.
4. **Setiap `POST` yang menghasilkan uang atau booking mengirim `Idempotency-Key`** (BR-090) — satu UUID
   per **niat pengguna**, dibuat saat form dibuka dan **dipakai ulang di setiap retry**. Kunci baru
   tiap percobaan membatalkan seluruh gunanya. `409 request-in-flight` artinya tunggu, bukan kirim
   ulang. Ini yang membuat retry di jaringan seluler aman; lihat `../docs/04-api-spec.md` §2.1.

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
| `unit-quota-exceeded` | *(menganggur — langganan ditunda)* Kalau suatu saat terbit: ajakan naik paket, bukan pesan error mentah |
| `rate-limited` | Halaman publik: minta coba lagi beberapa menit; jangan auto-retry |
| `request-in-flight` | Kunci tombol, tunggu, **jangan** kirim ulang dengan kunci baru (BR-090) |
| `email-not-verified` | **Ditangani di lapisan klien HTTP, bukan per layar** — alihkan ke layar verifikasi. Ia bisa muncul di endpoint mana pun (BR-006) |
| `deposit-already-paid` | Sembunyikan aksi bebaskan; arahkan ke pengembalian saat penyelesaian (BR-051) |
| `waiver-reason-required` | Field-level pada kolom alasan, bukan toast — pembebasan tanpa alasan tidak pernah tersimpan |
| `invalid-api-key` / `origin-not-allowed` | Hanya muncul di layar kelola kunci; jangan pernah tampilkan rahasianya lagi (BR-031) |

---

## Keadaan kalender: warna bukan satu-satunya pembawa arti

`GET /calendar` mengirim satu field `state` per segmen — delapan nilai, **dihitung server**
(BR-033). Jangan pernah menyusunnya di klien dari gabungan `booking.status` + `invoice.status` +
status unit: begitu klien menyusun sendiri, backoffice dan halaman publik mulai menyimpang.

| `state` | Token warna | Makna |
|---|---|---|
| `available` | `calendar.available` — hijau | unit bebas |
| `reserved_unpaid` | `calendar.reservedUnpaid` — biru | dipesan, belum bayar |
| `reserved_paid` | `calendar.reservedPaid` — biru tua | dipesan, lunas |
| `picked_up` | `calendar.pickedUp` — oranye | sedang disewa |
| `overdue` | `calendar.overdue` — merah | lewat waktu, belum balik |
| `buffer` | `calendar.buffer` — arsir abu | jeda bersih-bersih |
| `maintenance` | `calendar.maintenance` — hitam | unit di bengkel |
| `retired` | — | tidak dirender sama sekali |

Tokennya hidup di `src/theme/` (warisan Horizon, **ini penyebutan pertamanya sebagai kontrak**).
Nol hex di komponen — komponen memanggil token, supaya mengganti palet tidak berarti menyisir
seluruh layar.

Tiga aturan yang tidak boleh disederhanakan:

1. **Tiap blok punya label teks**, dan keadaan selain `available` punya pola atau border sendiri.
   Kalender yang hanya terbaca lewat warna tidak terbaca oleh sebagian penggunanya — dan operator
   memakai HP di bawah matahari.
2. **Legenda tampil di layar**, tidak disembunyikan di balik tooltip atau menu. Ia bagian dari
   layar, bukan bantuan.
3. **`draft` tidak dirender di kalender** (BR-023, BR-026). Ia tidak mengunci unit; blok yang
   terlihat sepadat `reserved` membuat operator menolak penjualan yang boleh jalan.

Booking `returned` yang depositnya belum beres **tidak** terlihat di kalender — selnya sudah
`available`. Ia muncul di dashboard sebagai daftar tersendiri (`S1-063`); jangan hapus daftar itu
mengira ia duplikat.

---

## Serah-terima: satu tangan, di HP, di parkiran

Ini alur yang paling sering dipakai dan paling sering dipakai dalam kondisi terburuk — sambil
berdiri, sambil dilihat penyewa, sinyal seadanya. Target: **selesai < 3 menit** (PRD §10).

- Target sentuh minimal 44px. Aksi utama dalam jangkauan ibu jari, di bawah layar.
- **Potongan diusulkan, bukan ditagih.** Denda telat dan kerusakan tampil sebagai daftar centang;
  yang tidak dicentang tidak terbit, dan membebaskan wajib mengisi alasan (BR-051). Sisa deposit
  dihitung ulang tiap centang berubah.
- **Aksi bebaskan deposit tersedia untuk operator**, selama invoice-nya belum lunas. Yang wajib:
  field alasan, dan nama pembebasnya ikut tercatat (BR-051).
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

**Langsung ke R2, tidak lewat API** (BR-093). Tiga langkah:

```ts
// 1. minta tanda tangan — kunci ditentukan server, jangan pernah mengarangnya sendiri
const { object_key, upload_url } = await api.presignUpload({
  kind: 'handover_photo', content_type: file.type, bytes: file.size,
})
// 2. PUT langsung ke R2 — di sinilah progres nyata didapat
await uploadWithProgress(upload_url, file, onProgress)
// 3. kirim KUNCI-nya, bukan berkasnya
await api.pickup(bookingId, { photo_keys: [object_key], meter_value })
```

- **Progres diambil dari `PUT`-nya**, bukan ditebak. Itu satu-satunya tempat progres nyata ada,
  dan foto 5 MB di jaringan seluler Indonesia memang lama — form tidak pernah diblokir menunggunya.
- **URL presign hidup 10 menit.** Kalau unggahan lebih lama dari itu, minta presign baru; jangan
  menyimpan `upload_url` untuk dipakai ulang nanti.
- **Jangan pernah mengarang `object_key`.** Server yang menentukannya, dan server mem-`HEAD`-nya
  sebelum menulis baris — kunci karangan dibalas `422 upload-not-found`, bukan diterima diam-diam.
- **Unggahan yang tidak jadi dikirim tidak perlu dibersihkan.** Objek mendarat di `pending/` dan
  hilang sendiri dalam 24 jam. Jangan bikin tombol "batalkan unggahan" yang memanggil DELETE.

Setelah tersimpan, foto **tidak bisa dihapus atau diganti** dari UI mana pun. Jangan render tombol
hapus pada foto handover, termasuk untuk peran `owner` (BR-037).

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
- Impor apa pun dari `(app)/` di dalam `(public)/[slug]/`.
- Impor Chakra, `theme/`, `components/` Horizon, atau `styles/App.css` di dalam
  `(public)/[slug]/`. Batas styling berjalan di garis yang sama dengan batas autentikasi.
- Menyetel cookie dengan atribut `Domain` di mana pun. Cookie backoffice host-only di
  `app.sewain.id`; cookie ber-`Domain=.sewain.id` bocor ke seluruh halaman publik.
- Menaruh `ChakraProvider` atau CSS global Horizon di `src/app/layout.tsx`.
- Cache atau `revalidate` data ketersediaan di halaman publik.
- Kirim `null` untuk field opsional yang dikosongkan pengguna — **kecuali keempat nominal
  `resources`**, tempat `null` justru satu-satunya cara mencabutnya (§Data & form aturan 1).
- Retry `409` secara otomatis.
- Menunggu pekerjaan asinkron di dalam satu request. Ekspor dan unggah bukti transfer membalas
  `202` + `job_id`; layar **poll `GET /jobs/{id}`** dan tetap bisa dipakai selama menunggu
  (BR-091). Sebutkan juga bahwa tautan unduhnya berumur 15 menit — pengguna yang menyimpannya
  untuk besok akan menemukannya mati (BR-077).
- Membuat `Idempotency-Key` baru saat me-retry `POST` yang sama (BR-090).
- Render tombol hapus/ubah pada baris atau foto serah-terima.
- Menampilkan alasan blacklist di permukaan publik.
- Hardcode simbol mata uang, format tanggal, atau zona waktu. Pakai `lib/format`.
- Merender tombol bayar gateway di mana pun. Endpoint-nya tidak terdaftar di fase 1
  (`../docs/04-api-spec.md` §3.8.1).
- Menandai tagihan lunas di UI setelah kembali dari halaman gateway. Redirect bukan bukti —
  tunggu status dari server (BR-064). Di fase 1 halaman gateway itu belum ada; aturannya berlaku
  begitu ia kembali.

`localStorage` boleh untuk kenyamanan ringan per pengguna — filter yang diingat, kolom yang
disembunyikan, sidebar yang terlipat. Bungkus baca/tulisnya dengan `try/catch` dan render dengan
benar saat kosong.

---

## Penjaga ruang lingkup fase 1

Tidak ada: layar stok, multi-cabang, kalender per jam, jadwal berulang mingguan, tanda tangan
digital, app native, direktori publik lintas pemilik.

Kalau sebuah desain menampilkannya, desainnya mendahului backlog. `../docs/05-backlog.md` §Di luar ruang
lingkup punya tabelnya beserta fasenya.

## Satuan harga tidak pernah ditanyakan ke juragan

`pricing_unit` diisi server dari `owners.business_type` yang dipilih sekali saat daftar
(BR-017). Form resource fase 1 **tidak merender pemilih satuan apa pun** — kedua preset
fase 1 (`vehicle_rental`, `equipment_rental`) cuma punya satu satuan: `day`.

Pemilih baru dirender ketika preset pemilik punya lebih dari satu satuan — `apartment`
(`day`/`week`/`month`), fase 2. Sampai itu, menampilkannya berarti meminta juragan
menjawab pertanyaan yang cuma ada demi vertikal yang belum dibuka, dan PRD §3.1 sudah
menyatakan juragan tidak akan mengisi data master sebelum bisa memakai produknya.

Di layar daftar (`(auth)/register/`), jenis usaha ditulis dengan bahasa juragan —
"rental mobil & motor", "rental alat & elektronik" — bukan nama enum-nya.

## Base URL API: selalu origin yang sedang dilayani

Klien yang digenerate **tidak pernah** menunjuk ke `api:8080` atau host internal apa pun.
Baik di browser maupun di server, ia menunjuk ke **origin permintaan yang sedang
dilayani** — dan di server, origin itu dibaca dari header, bukan dari konstanta:

```ts
// server component / route handler
import { headers } from 'next/headers'

const h = await headers()
const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
// → https://rentalbudi.sewain.id
```

Alasannya bukan kerapian. `owner_id` di jalur publik diturunkan backend dari `Host`
(BR-030) — kalau SSR memanggil `http://api:8080/…`, header yang sampai ke backend adalah
`api:8080` dan **tenant-nya hilang**: setiap halaman publik jadi `404`.

Tiga hal yang mengikat:

1. **Jangan pernah meng-hardcode host tenant.** Ambil dari `headers()`. Satu konstanta di
   sini berarti semua tenant merender katalog milik satu pemilik.
2. **Jangan mengakali dengan memalsukan `Host` ke `api` internal.** Itu memindahkan
   penjaga isolasi ke `web`, dan BR-030 menolaknya secara eksplisit.
3. **Panggilan SSR balik lewat proxy**, jadi ia satu hop lebih panjang. Pakai koneksi
   yang di-reuse (keep-alive) — anggaran `S1-028` p95 < 1 detik sudah menghitung satu
   hop, bukan satu handshake TLS baru per render.

**Di lokal ini butuh proxy juga.** `S1-001` menjalankan layanan di host tanpa container,
jadi tidak ada Caddy — dan `rentalbudi.localhost:3000` akan memantul ke Next sendiri,
bukan ke API Go di `:8080`. Jalankan Caddy lokal dengan rute yang sama (`/api/*` → `:8080`,
sisanya → `:3000`), atau halaman publik tidak bisa diuji sungguhan sampai deploy. Ini
bagian dari `S1-060`, bukan urusan masing-masing orang.
