'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Badge,
  Button,
  Card,
  Flex,
  Spinner,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { RangeSliderField } from 'components/fields/RangeSliderField'
import { SelectField } from 'components/fields/SelectField'
import { FilterCard } from 'components/table/FilterCard'
import { TableSearch } from 'components/table/TableSearch'
import { RowActions } from 'components/table/RowActions'
import { useCan } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import { formatRupiah, formatPrice } from 'lib/format/money'

import { resourceQuery, resourcesQuery, unitsQuery } from './queries'
import { VEHICLE_TYPES } from './vehiclePresets'

/**
 * `category` diisi server dari `vehicle_type` (BR-094), jadi nilainya enum
 * Inggris. Layar ini seluruhnya berbahasa Indonesia, dan petanya sudah ada --
 * sebelum ini `car` dan `motorcycle` dirender apa adanya.
 */
const KATEGORI: Record<string, string> = Object.fromEntries(
  VEHICLE_TYPES.map((t) => [t.value, t.label]),
)

/** Satu perhentian slider harga. */
const LANGKAH_HARGA = 10_000

/**
 * The catalogue.  (S1-018)
 *
 * Reading is open to both roles -- an operator's whole job, from booking to
 * handover, points at this list. Writing is the owner's (BR-003), and the
 * actions an operator does not have are not rendered rather than disabled.
 */
export default function CatalogPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canWrite = useCan('resources:write')
  const canSeePrices = useCan('pricing:write')
  // Hapus apa pun adalah hak `owner` saja (BR-003).
  const canDelete = useCan('records:delete')

  const [cari, setCari] = useState('')
  const [kategori, setKategori] = useState('')
  const [status, setStatus] = useState('')
  // null = belum disentuh, jadi slidernya memakai batas penuh.
  const [harga, setHarga] = useState<[number, number] | null>(null)

  const { data, isPending, error } = useQuery(resourcesQuery)

  /**
   * Batas slider diturunkan dari katalogmu sendiri, dibulatkan ke 50rb.
   *
   * Penjaga `+ LANGKAH_HARGA` wajib: kalau semua barang seharga sama, atas dan
   * bawah bertemu dan slidernya jadi sepanjang nol -- tidak bisa digeser sama
   * sekali.
   */
  const batasHarga = useMemo<[number, number]>(() => {
    if (data === undefined || data.length === 0) return [0, LANGKAH_HARGA]
    const semua = data.map((r) => r.base_price)
    const bawah = Math.floor(Math.min(...semua) / LANGKAH_HARGA) * LANGKAH_HARGA
    const atas = Math.ceil(Math.max(...semua) / LANGKAH_HARGA) * LANGKAH_HARGA
    return [bawah, atas > bawah ? atas : bawah + LANGKAH_HARGA]
  }, [data])

  const hargaTerpakai = harga ?? batasHarga
  // Rentang yang masih menyentuh kedua ujung tidak menyaring apa pun, jadi ia
  // tidak boleh ikut dihitung sebagai saring aktif.
  const hargaMenyaring =
    hargaTerpakai[0] !== batasHarga[0] || hargaTerpakai[1] !== batasHarga[1]

  const saringAktif =
    (kategori === '' ? 0 : 1) + (status === '' ? 0 : 1) + (hargaMenyaring ? 1 : 0)

  function bersihkanSaring() {
    setKategori('')
    setStatus('')
    setHarga(null)
  }

  const hapus = useMutation({
    retry: false,
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/resources/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['resources'] }),
  })

  // Dihitung dari `data`, bukan disimpan di state: satu sumber, dan hasil saring
  // tidak bisa basi terhadap daftarnya.
  const terlihat = useMemo(() => {
    if (data === undefined) return []
    const q = cari.trim().toLowerCase()
    return data.filter((r) => {
      const labelKategori = r.category === null ? '' : (KATEGORI[r.category] ?? r.category)
      if (q !== '' && !`${r.name} ${labelKategori}`.toLowerCase().includes(q)) return false
      if (kategori !== '' && r.category !== kategori) return false
      if (status !== '' && r.status !== status) return false
      // Batas inklusif di kedua ujung: "min 90.000" yang membuang barang
      // seharga 90.000 adalah jebakan, bukan presisi.
      if (hargaMenyaring && (r.base_price < hargaTerpakai[0] || r.base_price > hargaTerpakai[1])) {
        return false
      }
      return true
    })
  }, [data, cari, kategori, status, hargaMenyaring, hargaTerpakai])

  return (
    <PageShell
      title="Barang"
      subtitle="Jenis barang yang kamu sewakan. Unit fisiknya diatur di dalam masing-masing."
      action={
        canWrite && (
          <Button as={Link} href="/catalog/new" variant="brand" leftIcon={<AddIcon />}>
            Tambah barang
          </Button>
        )
      }
    >
      {isPending && (
        <Flex py="60px" justify="center">
          <Spinner size="lg" color="brand.500" thickness="3px" />
        </Flex>
      )}

      {error !== null && !isPending && (
        <Card variant="panel" role="alert">
          <Text color="text.primary">Daftar barang gagal dimuat. Muat ulang halaman ini.</Text>
        </Card>
      )}

      {data && data.length === 0 && (
        /* Satu ajakan jujur, bukan "tidak ada data": orang yang sampai di
           katalog kosong butuh langkah berikutnya, bukan status. */
        <EmptyState
          title="Belum ada barang"
          description="Mulai dari satu jenis barang — misalnya “Avanza 2021” — lalu tambahkan unit fisiknya satu per satu."
          action={
            canWrite && (
              <Button as={Link} href="/catalog/new" variant="brand" leftIcon={<AddIcon />} mx="auto">
                Tambah barang pertama
              </Button>
            )
          }
        />
      )}

      {data && data.length > 0 && (
        <>
          <FilterCard activeCount={saringAktif} onReset={bersihkanSaring}>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="0px 20px">
              <SelectField
                label="Kategori"
                value={kategori}
                onChange={setKategori}
                options={[
                  { value: '', label: 'Semua kategori' },
                  ...VEHICLE_TYPES.map((t) => ({ value: t.value, label: t.label })),
                ]}
              />
              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: '', label: 'Semua status' },
                  { value: 'active', label: 'Aktif' },
                  { value: 'inactive', label: 'Nonaktif' },
                ]}
              />
              {/* Harga tidak dirender untuk operator sama sekali, sama seperti
                  kolomnya -- saring atas nilai yang tidak boleh dilihat tetap
                  membocorkan nilainya (BR-003). */}
              {canSeePrices && (
                <RangeSliderField
                  label="Harga per hari"
                  min={batasHarga[0]}
                  max={batasHarga[1]}
                  step={LANGKAH_HARGA}
                  value={hargaTerpakai}
                  onChange={setHarga}
                  format={formatRupiah}
                />
              )}
            </SimpleGrid>
          </FilterCard>

          <Card variant="table">
            <TableSearch
              value={cari}
              onChange={setCari}
              placeholder="Cari nama atau kategori"
              resultCount={terlihat.length}
              totalCount={data.length}
            />
          <Table variant="simple" minW="720px">
            <Thead>
              <Tr>
                <Th>Nama</Th>
                <Th>Kategori</Th>
                {/* BR-003: kolom harga tidak dirender untuk operator sama
                    sekali -- bukan dikosongkan, bukan disamarkan. */}
                {canSeePrices && <Th>Harga</Th>}
                <Th isNumeric>Unit aktif</Th>
                <Th>Status</Th>
                {/* Tanpa label: isinya tombol ikon yang sudah punya nama
                    aksesibilitasnya sendiri per baris. */}
                <Th w="60px" aria-label="Aksi" />
              </Tr>
            </Thead>
            <Tbody>
              {terlihat.map((resource) => (
                <Tr key={resource.id} _hover={{ bg: 'surface.hover' }}>
                  <Td>
                    <Link href={`/catalog/${resource.id}`}>
                      <Text fontWeight="600" color="text.primary">
                        {resource.name}
                      </Text>
                    </Link>
                  </Td>
                  <Td color="text.secondary" fontSize="sm">
                    {resource.category === null ? '—' : (KATEGORI[resource.category] ?? resource.category)}
                  </Td>
                  {canSeePrices && (
                    <Td color="text.primary" fontSize="sm">
                      {formatPrice(resource.base_price, resource.pricing_unit)}
                    </Td>
                  )}
                  <Td isNumeric>
                    {resource.unit_count === 0 ? (
                      /* BR-010: nol unit aktif berarti barang ini tidak akan
                         pernah muncul di pencarian ketersediaan, berapa pun
                         statusnya sendiri. */
                      <Badge colorScheme="orange">belum ada unit</Badge>
                    ) : (
                      <Text color="text.primary">{resource.unit_count}</Text>
                    )}
                  </Td>
                  <Td>
                    <Badge colorScheme={resource.status === 'active' ? 'green' : 'gray'}>
                      {resource.status === 'active' ? 'aktif' : 'nonaktif'}
                    </Badge>
                  </Td>
                  <Td>
                    <RowActions
                      label={`Aksi untuk ${resource.name}`}
                      onEdit={canWrite ? () => router.push(`/catalog/${resource.id}`) : undefined}
                      // Semua peran boleh membuka layar unit; aksi di dalamnya dijaga layar itu sendiri.
                      extraItems={[{ label: 'Kelola unit', onClick: () => router.push(`/catalog/${resource.id}/units`) }]}
                      // Data layar unit diambil saat menu dibuka, bukan sesudah pindah
                      // layar: tanpa ini kunjungan pertama ke tiap barang berkedip
                      // spinner -> isi, sementara kunjungan kedua mulus dari cache.
                      onOpen={() => {
                        router.prefetch(`/catalog/${resource.id}/units`)
                        void queryClient.prefetchQuery(resourceQuery(resource.id))
                        void queryClient.prefetchQuery(unitsQuery(resource.id))
                      }}
                      onDelete={canDelete ? () => hapus.mutate(resource.id) : undefined}
                      deleteTitle={`Hapus ${resource.name}?`}
                      // Bukan basa-basi: server menghapus seluruh unitnya di
                      // transaksi yang sama (SoftDeleteUnitsOfResource), dan
                      // tidak pernah menolak karena ada booking -- nol 409 di
                      // kontrak. Dialog ini satu-satunya rem yang ada.
                      deleteBody="Seluruh unit di dalamnya ikut terhapus. Booking lama tetap terbaca karena masing-masing menyimpan salinan harganya sendiri."
                      busy={hapus.isPending}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {/* Hasil saring kosong bukan daftar kosong: yang satu minta kata kunci
              lain, yang satu minta barang pertama. */}
          {terlihat.length === 0 && (
            <Flex direction="column" align="center" gap="10px" py="40px" px="20px">
              <Text fontSize="sm" color="text.secondary" textAlign="center">
                Tidak ada barang yang cocok dengan saringan ini.
              </Text>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCari('')
                  bersihkanSaring()
                }}
              >
                Bersihkan semua
              </Button>
            </Flex>
          )}
          </Card>
        </>
      )}
    </PageShell>
  )
}
