'use client'

import { AddIcon } from '@chakra-ui/icons'
import {
  Box,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  Card,
  Flex,
  SimpleGrid,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useRadio,
  useRadioGroup,
  type UseRadioProps,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useRef, useState, type PropsWithChildren } from 'react'

import { EmptyState } from 'components/layout/EmptyState'
import { PageShell } from 'components/layout/PageShell'
import { DateRangeField, type DateRange } from 'components/fields/DateRangeField'
import { RangeSliderField } from 'components/fields/RangeSliderField'
import { SelectField } from 'components/fields/SelectField'
import { FilterCard } from 'components/table/FilterCard'
import { TableSearch } from 'components/table/TableSearch'
import { RowActions } from 'components/table/RowActions'
import { useCan, useSession } from 'contexts/SessionContext'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'


/**
 * Dimuat saat modalnya dibuka, bukan saat tabelnya dirender.
 *
 * Ia menyeret react-calendar beserta CSS-nya: +19 kB First Load JS di layar yang
 * tugasnya menampilkan daftar (terukur: 228 -> 247 kB). Modalnya memang hanya
 * dirender saat `dialog !== null`, jadi yang tidak menambah atau mengubah unit
 * tidak perlu mengunduhnya.
 */
const UnitDialog = dynamic(() => import('./UnitDialog').then((m) => m.UnitDialog), {
  ssr: false,
})

type UnitStatus = components['schemas']['UnitStatus']
type AffectedBooking = components['schemas']['AffectedBooking']
type Unit = components['schemas']['ResourceUnit']

/** Tiga segmen, urut dari yang paling sering dipakai ke yang paling akhir. */
const STATUS_OPTIONS: { value: UnitStatus; label: string }[] = [
  { value: 'active', label: 'Siap' },
  { value: 'maintenance', label: 'Bengkel' },
  { value: 'retired', label: 'Pensiun' },
]

const STATUS_LABEL: Record<UnitStatus, { text: string; scheme: string }> = {
  active: { text: 'siap disewakan', scheme: 'green' },
  maintenance: { text: 'di bengkel', scheme: 'orange' },
  retired: { text: 'pensiun', scheme: 'gray' },
}

/**
 * The units of one resource.  (S1-019)
 *
 * Taking a unit out of service warns and keeps. It never refuses and never
 * cancels: the server answers 200 with the bookings that are affected, this
 * screen shows them, and the owner decides (BR-013). Refusing instead would
 * make a juragan cancel bookings one at a time before being allowed to say the
 * car is in the workshop.
 */
export default function UnitsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const canWrite = useCan('units:write')
  // Hapus apa pun adalah hak `owner` saja (BR-003).
  const canDelete = useCan('records:delete')


  // Enam state form pindah ke UnitDialog bersama formnya.
  const [dialog, setDialog] = useState<{ unit: Unit | null } | null>(null)
  const [cari, setCari] = useState('')
  const [status, setStatus] = useState('')
  // null = belum disentuh, jadi slidernya memakai batas penuh.
  const [tahun, setTahun] = useState<[number, number] | null>(null)
  const [pajak, setPajak] = useState<DateRange>({ from: '', to: '' })
  const [stnk, setStnk] = useState<DateRange>({ from: '', to: '' })

  function bersihkanSaring() {
    setStatus('')
    setTahun(null)
    setPajak({ from: '', to: '' })
    setStnk({ from: '', to: '' })
  }

  /** Tanggal polos dibanding sebagai string: `YYYY-MM-DD` urut secara leksikal. */
  function diLuarRentang(nilai: string | null | undefined, rentang: DateRange): boolean {
    if (rentang.from === '' || rentang.to === '') return false
    // Yang belum diisi keluar begitu rentang dipasang: ia tidak bisa dibuktikan
    // masuk, dan menampilkannya membuat hasil berbohong tentang yang diminta.
    if (nilai === null || nilai === undefined) return true
    return nilai < rentang.from || nilai > rentang.to
  }

  const { owner } = useSession()
  const isVehicleRental = owner?.business_type === 'vehicle_rental'

  // The warning dialog. It opens on a SUCCESSFUL status change, which reads
  // oddly until you remember the change has already happened -- this is a
  // notice about consequences, not a confirmation gate.
  const [warning, setWarning] = useState<{ code: string; bookings: AffectedBooking[] } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const { data: resource } = useQuery({
    queryKey: ['resources', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources/{id}', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })

  const { data: units, isPending, error } = useQuery({
    queryKey: ['resources', id, 'units'],
    queryFn: async () => {
      const { data, error } = await api.GET('/resources/{id}/units', {
        params: { path: { id } },
      })
      if (error) throw error
      return data
    },
  })

  /**
   * Batasnya dari unit yang BENAR-BENAR ada, bukan dari `modelYears()`.
   *
   * `modelYears()` memberi 1990..tahun-depan lepas dari isi tabel: tiga puluh
   * delapan perhentian yang tiga puluh tujuh di antaranya menyaring ke nol baris.
   *
   * `null` ketika tahun berbedanya kurang dari dua -- slider yang batas bawah
   * dan atasnya bertemu panjangnya nol dan tidak bisa digeser sama sekali, jadi
   * kontrolnya tidak dirender. Ia muncul sendiri begitu ada unit bertahun lain.
   */
  const batasTahun = useMemo<[number, number] | null>(() => {
    const semua = (units ?? [])
      .map((u) => u.vehicle?.year)
      .filter((y): y is number => typeof y === 'number')
    if (new Set(semua).size < 2) return null
    return [Math.min(...semua), Math.max(...semua)]
  }, [units])

  const tahunTerpakai = tahun ?? batasTahun
  // Rentang yang masih menyentuh kedua ujung tidak menyaring apa pun.
  const tahunMenyaring =
    batasTahun !== null &&
    tahunTerpakai !== null &&
    (tahunTerpakai[0] !== batasTahun[0] || tahunTerpakai[1] !== batasTahun[1])

  const saringAktif =
    (status === '' ? 0 : 1) +
    (tahunMenyaring ? 1 : 0) +
    (pajak.from === '' ? 0 : 1) +
    (stnk.from === '' ? 0 : 1)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['resources', id, 'units'] })
    // The resource's unit_count is derived from these rows, so it goes stale
    // at the same moment they do.
    void queryClient.invalidateQueries({ queryKey: ['resources'] })
  }

  const terlihat = useMemo(() => {
    if (units === undefined) return []
    const q = cari.trim().toLowerCase()
    return units.filter((u) => {
      if (q !== '' && !`${u.code} ${u.label ?? ''}`.toLowerCase().includes(q)) return false
      if (status !== '' && u.status !== status) return false
      // Unit tanpa tahun tersaring keluar begitu batas tahun dipasang: ia tidak
      // bisa dibuktikan masuk rentang, dan menampilkannya membuat hasilnya
      // berbohong tentang apa yang baru saja diminta.
      const th = u.vehicle?.year ?? null
      if (
        tahunMenyaring &&
        tahunTerpakai !== null &&
        (th === null || th < tahunTerpakai[0] || th > tahunTerpakai[1])
      ) {
        return false
      }
      if (diLuarRentang(u.vehicle?.tax_due_on, pajak)) return false
      if (diLuarRentang(u.vehicle?.registration_valid_until, stnk)) return false
      return true
    })
  }, [units, cari, status, tahunMenyaring, tahunTerpakai, pajak, stnk])

  const hapus = useMutation({
    retry: false,
    mutationFn: async (unitId: string) => {
      const { error } = await api.DELETE('/units/{id}', { params: { path: { id: unitId } } })
      if (error) throw error
    },
    onSettled: refresh,
  })

  const changeStatus = useMutation({
    retry: false,
    mutationFn: async (vars: { unitId: string; status: UnitStatus }) => {
      const { data, error } = await api.PATCH('/units/{id}', {
        params: { path: { id: vars.unitId } },
        body: { status: vars.status },
      })
      if (error) throw error
      return data
    },
    onSuccess: (updated) => {
      refresh()
      if (updated.status !== 'active') {
        setWarning({
          code: updated.code,
          bookings: updated.warning.affected_bookings,
        })
      }
    },
  })

  return (
    <PageShell
      width="form"
      title="Unit"
      // Nama barangnya pindah ke jejak, jadi judulnya tidak lagi mengulang apa
      // yang sudah tertulis satu baris di atasnya.
      breadcrumb={[
        { label: 'Barang', href: '/catalog' },
        // Dihilangkan selama namanya belum datang, bukan diganti teks sementara:
        // segmen "Barang / Barang / Unit" lebih membingungkan daripada jejak
        // yang pendek sebentar.
        ...(resource ? [{ label: resource.name, href: `/catalog/${id}` }] : []),
      ]}
      subtitle="Barang fisiknya, satu baris per plat atau nomor seri."
      action={
        // Hanya saat barangnya benar-benar ada. Dulu formnya menempel di
        // halaman dan tetap dirender meski barangnya 404 -- juragan bisa
        // mengisi form yang pasti gagal.
        canWrite &&
        error === null &&
        resource !== undefined && (
          <Button
            variant="brand"
            leftIcon={<AddIcon />}
            onClick={() => setDialog({ unit: null })}
          >
            Tambah unit
          </Button>
        )
      }
    >

      {isPending && (
        <Flex py="60px" justify="center">
          <Spinner size="lg" color="brand.500" thickness="3px" />
        </Flex>
      )}

      {/* Layar ini dulu tidak punya keadaan galat sama sekali: `error` tidak
          pernah didestrukturisasi, jadi fetch yang gagal merender header lalu
          kekosongan. Layar katalog sudah punya ini sejak awal. */}
      {error !== null && !isPending && (
        <Card variant="panel" role="alert">
          <Text color="text.primary">Daftar unit gagal dimuat. Muat ulang halaman ini.</Text>
        </Card>
      )}

      {units && units.length === 0 && (
        <EmptyState
          title="Belum ada unit"
          description={
            canWrite
              ? 'Barang ini belum bisa dibooking sampai ada satu unit. Mulai dari tombol Tambah unit di atas.'
              : 'Barang ini belum bisa dibooking sampai ada satu unit yang siap disewakan.'
          }
        />
      )}

      {units && units.length > 0 && (
        <>
          <FilterCard activeCount={saringAktif} onReset={bersihkanSaring}>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: '', label: 'Semua status' },
                  ...STATUS_OPTIONS.map((o) => ({ value: o.value as string, label: o.label })),
                ]}
              />
              {/* Tahun, pajak, dan STNK hanya ada pada preset kendaraan
                  (BR-094), jadi saringnya pun tidak dirender untuk preset lain. */}
              {isVehicleRental && (
                <>
                  {batasTahun !== null && tahunTerpakai !== null && (
                    <RangeSliderField
                      label="Tahun"
                      min={batasTahun[0]}
                      max={batasTahun[1]}
                      step={1}
                      value={tahunTerpakai}
                      onChange={setTahun}
                    />
                  )}
                  <DateRangeField
                    label="Pajak jatuh tempo"
                    value={pajak}
                    onChange={setPajak}
                    helper="Unit yang tanggalnya belum diisi tidak ikut tampil."
                  />
                  <DateRangeField
                    label="STNK berlaku s.d."
                    value={stnk}
                    onChange={setStnk}
                    helper="Unit yang tanggalnya belum diisi tidak ikut tampil."
                  />
                </>
              )}
            </SimpleGrid>
          </FilterCard>

          <Card variant="table">
            <TableSearch
              value={cari}
              onChange={setCari}
              placeholder="Cari plat atau nama panggilan"
              resultCount={terlihat.length}
              totalCount={units.length}
            />
          <Table variant="simple" minW="640px">
            <Thead>
              <Tr>
                <Th>Plat / seri</Th>
                <Th>Nama panggilan</Th>
                {isVehicleRental && <Th>Tahun &amp; warna</Th>}
                <Th w="240px">Status</Th>
                <Th w="60px" aria-label="Aksi" />
              </Tr>
            </Thead>
            <Tbody>
              {terlihat.map((unit) => (
                <Tr key={unit.id}>
                  <Td>
                    <Text fontWeight="600" color="text.primary">
                      {unit.code}
                    </Text>
                  </Td>
                  <Td color="text.secondary" fontSize="sm">
                    {unit.label ?? '—'}
                  </Td>
                  {isVehicleRental && (
                    <Td color="text.secondary" fontSize="sm">
                      {unit.vehicle
                        ? [unit.vehicle.year, unit.vehicle.color].filter(Boolean).join(' · ')
                        : '—'}
                    </Td>
                  )}
                  <Td>
                    {canWrite ? (
                      <StatusToggle
                        unitCode={unit.code}
                        value={unit.status}
                        isDisabled={changeStatus.isPending}
                        onChange={(status) => changeStatus.mutate({ unitId: unit.id, status })}
                      />
                    ) : (
                      <Badge colorScheme={STATUS_LABEL[unit.status].scheme}>
                        {STATUS_LABEL[unit.status].text}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <RowActions
                      label={`Aksi untuk ${unit.code}`}
                      onEdit={canWrite ? () => setDialog({ unit }) : undefined}
                      onDelete={canDelete ? () => hapus.mutate(unit.id) : undefined}
                      deleteTitle={`Hapus ${unit.code}?`}
                      // BR-011: kodenya kembali bisa dipakai sesudah ini, karena
                      // unique index-nya `WHERE deleted_at IS NULL`.
                      deleteBody="Barisnya tetap tersimpan dan booking lama tetap terbaca. Plat ini bisa dipakai lagi untuk unit baru."
                      busy={hapus.isPending}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {terlihat.length === 0 && (
            <Flex direction="column" align="center" gap="10px" py="40px" px="20px">
              <Text fontSize="sm" color="text.secondary" textAlign="center">
                Tidak ada unit yang cocok dengan saringan ini.
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

      {/* Dirender hanya saat terbuka supaya state form-nya lahir ulang tiap
          kali: satu komponen untuk tambah dan edit, dan isian unit sebelumnya
          tidak boleh bocor ke unit berikutnya. */}
      {dialog !== null && (
        <UnitDialog
          resourceId={id}
          isVehicleRental={isVehicleRental}
          unit={dialog.unit}
          isOpen
          onClose={() => setDialog(null)}
        />
      )}

      <AlertDialog
        isOpen={warning !== null}
        leastDestructiveRef={closeRef}
        onClose={() => setWarning(null)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="20px">
            <AlertDialogHeader fontSize="lg" fontWeight="700">
              {warning?.code} keluar dari peredaran
            </AlertDialogHeader>
            <AlertDialogBody>
              {warning && warning.bookings.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  Tidak ada booking yang terdampak. Unit ini tidak akan muncul lagi di pencarian
                  ketersediaan sampai statusnya dikembalikan.
                </Text>
              ) : (
                <>
                  <Text fontSize="sm" color="text.secondary" mb="12px">
                    Booking di bawah ini <strong>tidak dibatalkan</strong>. Kamu yang memutuskan
                    apa yang terjadi pada masing-masing.
                  </Text>
                  <Table size="sm" variant="simple">
                    <Tbody>
                      {warning?.bookings.map((booking) => (
                        <Tr key={booking.code}>
                          <Td>{booking.code}</Td>
                          <Td>{new Date(booking.start_at).toLocaleDateString('id-ID')}</Td>
                          <Td>{booking.status}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={closeRef} variant="brand" onClick={() => setWarning(null)}>
                Mengerti
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </PageShell>
  )
}

/**
 * Status unit sebagai tiga segmen.
 *
 * `useRadioGroup`, bukan tiga tombol: ini pilihan tunggal dari tiga, jadi
 * perannya `radiogroup`/`radio` dengan `aria-checked` dan navigasi panah.
 * Tiga tombol yang kebetulan berdampingan tidak mengumumkan mana yang terpilih.
 *
 * Mengubahnya LANGSUNG menyimpan, dan itu memang kontraknya: BR-013 menegaskan
 * responsnya peringatan, bukan penolakan -- barisnya sudah berubah waktu daftar
 * booking terdampak dibaca. Jadi tidak ada konfirmasi sebelum klik, dan dialog
 * sesudahnya tetap satu tombol.
 */
function StatusToggle({
  unitCode,
  value,
  isDisabled,
  onChange,
}: {
  unitCode: string
  value: UnitStatus
  isDisabled: boolean
  onChange: (status: UnitStatus) => void
}) {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name: `status-${unitCode}`,
    value,
    onChange: (next) => onChange(next as UnitStatus),
  })

  return (
    <Flex
      {...getRootProps()}
      aria-label={`Status ${unitCode}`}
      display="inline-flex"
      borderRadius="10px"
      overflow="hidden"
      border="1px solid"
      borderColor="border.subtle"
      opacity={isDisabled ? 0.5 : 1}
      pointerEvents={isDisabled ? 'none' : undefined}
    >
      {STATUS_OPTIONS.map((option) => (
        <StatusSegment key={option.value} {...getRadioProps({ value: option.value })}>
          {option.label}
        </StatusSegment>
      ))}
    </Flex>
  )
}

function StatusSegment({ children, ...radio }: PropsWithChildren<UseRadioProps>) {
  const { getInputProps, getRadioProps: getSegmentProps, state } = useRadio(radio)

  return (
    <Box as="label" cursor="pointer">
      <input {...getInputProps()} />
      <Box
        {...getSegmentProps()}
        px="10px"
        py="7px"
        fontSize="xs"
        fontWeight="600"
        whiteSpace="nowrap"
        textAlign="center"
        color={state.isChecked ? 'white' : 'text.secondary'}
        bg={state.isChecked ? 'brand.500' : 'transparent'}
        _hover={state.isChecked ? undefined : { bg: 'surface.hover' }}
        // Cincin fokus di segmennya, bukan di input yang tersembunyi.
        _focusVisible={{ boxShadow: 'outline' }}
      >
        {children}
      </Box>
    </Box>
  )
}
