'use client'

import {
  Box,
  Button,
  Card,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Radio,
  RadioGroup,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'

import { CountField } from 'components/fields/CountField'
import { FormSection } from 'components/fields/FormSection'
import { MoneyField } from 'components/fields/MoneyField'
import { SelectField } from 'components/fields/SelectField'
import { api } from 'lib/api/client'
import { formatRupiah } from 'lib/format/money'

import { FUELS, PLACEHOLDERS, TRANSMISSIONS, VEHICLE_TYPES } from './vehiclePresets'

/**
 * Dimuat belakangan, dan pasangannya adalah kartu yang tertutup default.
 *
 * Tiptap + prosemirror + markdown-it menambah ~180 kB ke First Load JS kalau
 * diimpor statis -- di dua layar form, untuk empat field yang tidak selalu
 * dibuka. Karena "Deskripsi" dan "Syarat & ketentuan" memang mulai terlipat,
 * yang tidak membukanya tidak pernah mengunduhnya.
 *
 * `ssr: false` karena editornya memang tidak dirender di server (`immediatelyRender:
 * false` di dalam komponennya sendiri menangani hal yang sama dari sisi Tiptap).
 */
const MarkdownField = dynamic(
  () => import('components/fields/MarkdownField').then((m) => m.MarkdownField),
  {
    ssr: false,
    loading: () => <Skeleton h="180px" borderRadius="16px" mb="20px" />,
  },
)
import { useUnsavedChanges } from 'hooks/useUnsavedChanges'
import type { components } from 'lib/api/schema'

type Resource = components['schemas']['Resource']
type VehicleType = components['schemas']['VehicleType']
type Transmission = components['schemas']['Transmission']
type Fuel = components['schemas']['Fuel']

export type ResourceDraft = {
  name: string
  base_price: number | null
  deposit_amount: number | null
  late_fee_per_unit: number | null
  min_duration: number | null
  max_duration: number | null
  buffer_minutes: number | null
  requires_id_verification: boolean
  status: 'active' | 'inactive'

  description: string
  terms_excludes: string
  terms_requirements: string
  terms_cancellation: string

  /** Null untuk preset yang bukan `vehicle_rental` (BR-094). */
  vehicle: VehicleDraft | null
}

export type VehicleDraft = {
  vehicle_type: VehicleType
  transmission: Transmission
  seats: number | null
  fuel: Fuel
}

export function draftOf(resource?: Resource, isVehicleRental = false): ResourceDraft {
  return {
    name: resource?.name ?? '',
    base_price: resource?.base_price ?? null,
    deposit_amount: resource?.deposit_amount ?? null,
    late_fee_per_unit: resource?.late_fee_per_unit ?? null,
    min_duration: resource?.min_duration ?? null,
    max_duration: resource?.max_duration ?? null,
    buffer_minutes: resource?.buffer_minutes ?? 0,
    requires_id_verification: resource?.requires_id_verification ?? false,
    status: (resource?.status as 'active' | 'inactive') ?? 'active',

    description: resource?.description ?? '',
    terms_excludes: resource?.terms_excludes ?? '',
    terms_requirements: resource?.terms_requirements ?? '',
    terms_cancellation: resource?.terms_cancellation ?? '',

    // Mobil manual bensin tujuh kursi adalah armada rental Indonesia yang paling
    // umum, jadi default-nya menghemat empat klik untuk mayoritas — dan tetap
    // satu klik untuk mengubahnya.
    vehicle:
      resource?.vehicle ??
      (isVehicleRental
        ? { vehicle_type: 'car', transmission: 'manual', seats: 7, fuel: 'gasoline' }
        : null),
  }
}

/**
 * The server's wording for a refused field, in the juragan's language.
 *
 * `Problem.detail` from internal/catalog is English, like every other message
 * in that package -- it is written for whoever reads the log. The person
 * looking at this form is not that reader, so the screen owns its own words,
 * exactly as (auth)/register does for `email-taken`.
 *
 * Anything not listed falls through to the server's own text rather than to a
 * blank: a message nobody translated is still better than no message.
 */
const FIELD_MESSAGES: Record<string, string> = {
  'vehicle.seats': 'Mobil wajib punya jumlah kursi, dan motor tidak boleh punya.',
  'vehicle.transmission': 'Kopling cuma ada di motor.',
  'vehicle.fuel': 'Solar cuma ada di mobil.',
  'vehicle.year': 'Tahun paling lama 1990.',
  vehicle: 'Isian kendaraan belum lengkap.',
  description: 'Deskripsi maksimal 500 karakter.',
  terms_excludes: 'Bagian "belum termasuk" maksimal 500 karakter.',
  terms_requirements: 'Syarat sewa maksimal 1.000 karakter.',
  terms_cancellation: 'Kebijakan pembatalan maksimal 1.000 karakter.',
}

const EMPTY_INSTEAD_OF_ZERO: Record<string, string> = {
  base_price: 'Harga tidak boleh minus.',
  deposit_amount: 'Kosongkan saja kalau barang ini tanpa deposit. Nol tidak diterima — laporan tidak bisa membedakan "deposit nol rupiah" dari "tanpa deposit".',
  late_fee_per_unit: 'Kosongkan saja kalau tidak ada denda telat. Nol tidak diterima.',
  min_duration: 'Kosongkan saja kalau tidak ada durasi minimum. Nol tidak diterima.',
  max_duration: 'Kosongkan saja kalau tidak ada durasi maksimum. Nol tidak diterima.',
  buffer_minutes: 'Jeda tidak boleh minus. Nol berarti tanpa jeda.',
}

export function localiseErrors(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, detail]) => [
      field,
      EMPTY_INSTEAD_OF_ZERO[field] ?? FIELD_MESSAGES[field] ?? detail,
    ]),
  )
}

type ResourceFormProps = {
  initial: ResourceDraft
  /** Satuan harga dalam bahasa juragan, hanya diketahui sesudah resource ada. */
  unitLabel?: string
  submitLabel: string
  busy: boolean
  errors: Record<string, string>
  formError: string
  /** Rendered only on the edit screen; a new resource is always born active. */
  showStatus?: boolean

  /**
   * Kartu tambahan di kolom kanan, di atas kartu aksi.
   *
   * Halamannya yang mengisi karena halamannya yang punya `resource`; form ini
   * cuma punya draft. Layar tambah barang tidak mengirim apa-apa -- barang yang
   * belum ada tidak punya apa pun untuk dilaporkan.
   */
  aside?: ReactNode
  onSubmit: (draft: ResourceDraft) => void
  onCancel: () => void
}

/**
 * The resource editor, shared by /catalog/new and /catalog/[id].  (S1-018)
 *
 * Three things this form deliberately does not do:
 *
 * 1. **It never asks for a pricing unit.** The owner's preset decides it
 *    (BR-017), and both phase-1 presets have exactly one. A picker here would
 *    be a question that exists only for a vertical nobody has opened.
 *
 * 2. **It never writes 0 into an empty nominal.** Empty means the rule does
 *    not apply; 0 means it applies and is worth nothing, and the database
 *    refuses the second (BR-016). MoneyField parses empty to null.
 *
 * 3. **It does not render price fields it has no permission for.** The caller
 *    decides that -- see the edit page, which shows a read-only view instead.
 */
export function ResourceForm({
  initial,
  unitLabel,
  submitLabel,
  busy,
  errors,
  formError,
  showStatus,
  aside,
  onSubmit,
  onCancel,
}: ResourceFormProps) {
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [localError, setLocalError] = useState('')
  const leaveDialog = useUnsavedChanges(dirty && !busy)

  const brandStars = useColorModeValue('brand.500', 'brand.400')
  // Knob pemilik, untuk merakit kalimat 5a. Cache-nya dibagi seluruh aplikasi,
  // jadi membuka form kedua kalinya tidak memanggil ulang.
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await api.GET('/settings')
      if (error) throw error
      return data
    },
  })

  function set<K extends keyof ResourceDraft>(key: K, value: ResourceDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }

  function setVehicle(patch: Partial<VehicleDraft>) {
    setDraft((d) => (d.vehicle ? { ...d, vehicle: { ...d.vehicle, ...patch } } : d))
    setDirty(true)
  }

  /**
   * Mengganti jenis membawa serta transmisi, BBM, dan kursi.
   *
   * Bukan kerapian: kopling hanya ada di motor dan solar hanya ada di mobil,
   * jadi nilai lama bisa jadi tidak sah untuk jenis baru — dan kursi WAJIB ada
   * pada mobil, DILARANG pada motor (BR-094). Membiarkannya berarti mengirim
   * kombinasi yang pasti ditolak database.
   */
  function setVehicleType(next: VehicleType) {
    setDraft((d) => ({
      ...d,
      vehicle: {
        vehicle_type: next,
        transmission: TRANSMISSIONS[next][0].value,
        fuel: 'gasoline',
        seats: next === 'car' ? 7 : null,
      },
    }))
    setDirty(true)
  }

  const placeholders = PLACEHOLDERS[draft.vehicle?.vehicle_type ?? 'car']

  /**
   * Kalimat 5a (BR-095): dirakit dari kolom yang sudah ada, tidak pernah diketik.
   *
   * Yang bergantung pada `pricing_unit` cuma muncul di layar ubah, karena satuan
   * itu baru ada sesudah server mengisinya dari preset (BR-017). Menghitungnya
   * di klien berarti menyalin konstanta server ke sini — persis yang dilarang
   * BR-017 aturan 4.
   */
  const computed: string[] = []
  if (settings) {
    computed.push(
      `Bayar paling lambat ${settings.payment_due_hours} jam, atau booking batal otomatis.`,
    )
    computed.push(
      settings.no_show_tolerance_hours === 0
        ? 'Tidak datang di jam mulai = booking batal.'
        : `Tidak datang lewat ${settings.no_show_tolerance_hours} jam dari jadwal = batal.`,
    )
  }
  if (unitLabel) {
    computed.unshift(`1 ${unitLabel} = 24 jam.`)
    if (draft.late_fee_per_unit !== null) {
      computed.push(
        `Telat kembali dikenakan ${formatRupiah(draft.late_fee_per_unit)} per ${unitLabel}.`,
      )
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()

        // Checked here as well as in the database, and that is not a second
        // source of truth: the CHECK is still the enforcer. This exists so the
        // answer arrives before a round trip AND in the right language --
        // the server names the field but not which of its rules fired, so
        // without this the zero message would be shown for an inverted range.
        if (
          draft.min_duration !== null &&
          draft.max_duration !== null &&
          draft.max_duration < draft.min_duration
        ) {
          setLocalError('Durasi maksimum tidak boleh lebih pendek dari durasi minimum.')
          return
        }
        setLocalError('')

        // Cleared before the request rather than after it succeeds: the
        // navigation that follows a save must not hit its own prompt.
        setDirty(false)
        onSubmit(draft)
      }}
    >
      {/* Dua kolom di lg ke atas, satu kolom di bawahnya. `lg` = 960px di
          proyek ini, bukan 992 bawaan Chakra (foundations/breakpoints.ts). */}
      <Flex gap="20px" align="flex-start" direction={{ base: 'column', lg: 'row' }}>
        <Box flex="1" minW="0" w="100%" pb={{ base: '90px', lg: '0' }}>
        <FormSection title="Barang">
          <SimpleGrid columns={{ base: 1, md: showStatus ? 2 : 1 }} gap="0px 20px">
            <FormControl isInvalid={errors.name !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
                Nama
                <Text as="span" color={brandStars}>
                  *
                </Text>
              </FormLabel>
              <Input
                isRequired
                placeholder="Avanza 2021"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <FormErrorMessage>{errors.name}</FormErrorMessage>
            </FormControl>

            {showStatus && (
              <SelectField
                label="Status"
                value={draft.status}
                onChange={(v) => set('status', v as 'active' | 'inactive')}
                options={[
                  { value: 'active', label: 'Aktif', hint: 'Masih disewakan' },
                  { value: 'inactive', label: 'Nonaktif', hint: 'Tidak ditawarkan lagi' },
                ]}
              />
            )}
          </SimpleGrid>
        </FormSection>

        {draft.vehicle && (
          <FormSection
            title="Kendaraan"
            description="Yang paling sering ditanya penyewa sebelum booking. Sisanya tulis di deskripsi."
          >
            <FormControl isInvalid={errors.vehicle !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
                Jenis
                <Text as="span" color={brandStars}>
                  *
                </Text>
              </FormLabel>
              {/* Dikunci sesudah resource dibuat (BR-094): mengubah motor jadi mobil
                  melanggar CHECK kursi kecuali kursinya ikut diisi di transaksi yang
                  sama. Juragan yang salah pilih membuat resource baru. */}
              <RadioGroup
                value={draft.vehicle.vehicle_type}
                isDisabled={showStatus}
                onChange={(v) => setVehicleType(v as VehicleType)}
              >
                <Stack direction="row" spacing="24px" ms="4px">
                  {VEHICLE_TYPES.map((t) => (
                    <Radio key={t.value} value={t.value} colorScheme="brand">
                      <Text fontSize="sm" fontWeight="500" color="text.primary">
                        {t.label}
                      </Text>
                    </Radio>
                  ))}
                </Stack>
              </RadioGroup>
              <FormHelperText ms="4px" fontSize="xs" color="text.secondary">
                {showStatus
                  ? 'Jenis tidak bisa diubah. Kalau salah, buat barang baru.'
                  : `Contoh: ${VEHICLE_TYPES.find((t) => t.value === draft.vehicle?.vehicle_type)?.hint}`}
              </FormHelperText>
              <FormErrorMessage>{errors.vehicle}</FormErrorMessage>
            </FormControl>

            <SimpleGrid
              columns={{ base: 1, md: draft.vehicle.vehicle_type === 'car' ? 3 : 2 }}
              gap="0px 20px"
            >
              {/* Pilihannya menyusut per jenis: kopling tidak pernah muncul untuk
                  mobil, jadi juragan tidak bisa memilih yang akan ditolak. */}
              <SelectField
                label="Transmisi"
                value={draft.vehicle.transmission}
                onChange={(v) => setVehicle({ transmission: v as Transmission })}
                options={TRANSMISSIONS[draft.vehicle.vehicle_type]}
                error={errors['vehicle.transmission']}
              />

              <SelectField
                label="Bahan bakar"
                value={draft.vehicle.fuel}
                onChange={(v) => setVehicle({ fuel: v as Fuel })}
                options={FUELS[draft.vehicle.vehicle_type]}
                error={errors['vehicle.fuel']}
              />

              {/* Hilang sama sekali untuk motor, bukan dinonaktifkan: database
                  MELARANG motor punya jumlah kursi (BR-094). */}
              {draft.vehicle.vehicle_type === 'car' && (
                <CountField
                  label="Jumlah kursi"
                  nullable={false}
                  value={draft.vehicle.seats}
                  onChange={(v) => setVehicle({ seats: v })}
                  error={errors['vehicle.seats']}
                />
              )}
            </SimpleGrid>
          </FormSection>
        )}

        <FormSection
          title="Harga & jaminan"
          description="Disalin ke booking saat dibuat. Mengubahnya tidak menyentuh booking yang sudah jalan."
        >
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="0px 20px">
            <MoneyField
              label="Harga sewa per hari"
              nullable={false}
              value={draft.base_price}
              onChange={(v) => set('base_price', v)}
              error={errors.base_price}
            />
            <MoneyField
              label="Deposit"
              nullable
              emptyMeans="Kosong = tanpa deposit. Jangan isi 0."
              value={draft.deposit_amount}
              onChange={(v) => set('deposit_amount', v)}
              error={errors.deposit_amount}
            />
            <MoneyField
              label="Denda telat per hari"
              nullable
              emptyMeans="Kosong = tanpa denda. Jangan isi 0."
              value={draft.late_fee_per_unit}
              onChange={(v) => set('late_fee_per_unit', v)}
              error={errors.late_fee_per_unit}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Aturan sewa">
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="0px 20px">
            <CountField
              label="Durasi minimum (hari)"
              nullable
              emptyMeans="Kosong = tanpa batas bawah."
              value={draft.min_duration}
              onChange={(v) => set('min_duration', v)}
              error={errors.min_duration}
            />
            <CountField
              label="Durasi maksimum (hari)"
              nullable
              emptyMeans="Kosong = tanpa batas atas."
              value={draft.max_duration}
              onChange={(v) => set('max_duration', v)}
              error={localError !== '' ? localError : errors.max_duration}
            />
            <CountField
              label="Jeda bersih-bersih (menit)"
              nullable={false}
              emptyMeans="Sebelum unit yang sama bisa disewa lagi. 0 = tanpa jeda."
              value={draft.buffer_minutes}
              onChange={(v) => set('buffer_minutes', v ?? 0)}
              error={errors.buffer_minutes}
            />
          </SimpleGrid>

          <Divider borderColor="border.subtle" mb="16px" />

          <FormControl display="flex" alignItems="center" gap="12px">
            <Switch
              id="requires-id"
              colorScheme="brand"
              isChecked={draft.requires_id_verification}
              onChange={(e) => set('requires_id_verification', e.target.checked)}
            />
            <FormLabel htmlFor="requires-id" mb="0" fontSize="sm" fontWeight="500" color="text.primary">
              Wajib verifikasi identitas penyewa
            </FormLabel>
          </FormControl>
        </FormSection>

        <FormSection
          title="Deskripsi"
          description="Tampil di halaman publik. Kalau kosong, bagian ini tidak ditampilkan."
          collapsible
          defaultOpen={initial.description !== ''}
        >
          <MarkdownField
            label="Fitur &amp; perlengkapan"
            example={placeholders.description}
            maxLength={500}
            value={draft.description}
            onChange={(v) => set('description', v)}
            error={errors.description}
          />
        </FormSection>

        <FormSection
          title="Syarat & ketentuan"
          description="Tampil di halaman publik. Bagian yang kosong tidak ditampilkan."
          collapsible
          // `initial`, bukan `draft`: dihitung dari yang datang dari server, jadi
          // mengetik di satu field tidak membuka-tutup kartunya sendiri.
          defaultOpen={[
            initial.terms_excludes,
            initial.terms_requirements,
            initial.terms_cancellation,
          ].some((t) => t !== '')}
        >
          {computed.length > 0 && (
            <Box
              bg="surface.sunken"
              borderRadius="12px"
              p="14px 16px"
              mb="20px"
              aria-readonly="true"
            >
              <Text fontSize="xs" fontWeight="600" color="text.primary" mb="6px">
                Ditulis otomatis dari pengaturanmu
              </Text>
              {computed.map((line) => (
                <Text key={line} fontSize="xs" color="text.secondary">
                  • {line}
                </Text>
              ))}
              {/* BR-095: keempatnya dihitung sistem dan TIDAK bisa diketik. Juragan
                  yang mengetik ulang "bayar maksimal 24 jam" ke textarea di bawah
                  akan salah pada detik ia mengubah knob-nya, dan halaman publiknya
                  berbohong tanpa ada yang tahu. */}
              <Text fontSize="xs" color="text.secondary" mt="8px" fontStyle="italic">
                Jangan tulis ulang yang di atas — ia ikut berubah sendiri kalau pengaturanmu
                berubah.
              </Text>
            </Box>
          )}

          <MarkdownField
            label="Belum termasuk"
            example={placeholders.terms_excludes}
            maxLength={500}
            value={draft.terms_excludes}
            onChange={(v) => set('terms_excludes', v)}
            error={errors.terms_excludes}
          />
          <MarkdownField
            label="Syarat sewa"
            example={placeholders.terms_requirements}
            maxLength={1000}
            value={draft.terms_requirements}
            onChange={(v) => set('terms_requirements', v)}
            error={errors.terms_requirements}
          />
          <MarkdownField
            label="Pembatalan &amp; perubahan"
            example={placeholders.terms_cancellation}
            maxLength={1000}
            helper="Refund dan reschedule dijalankan manual olehmu di fase ini."
            value={draft.terms_cancellation}
            onChange={(v) => set('terms_cancellation', v)}
            error={errors.terms_cancellation}
          />
        </FormSection>

        </Box>

        {/* Satu simpul DOM, dua perilaku. Di bawah lg ia bilah yang menempel di
            dasar layar -- urutan DOM sudah menaruhnya sesudah form. Di lg ke
            atas ia kolom kanan yang menempel di bawah navbar. Merender dua
            varian akan memberi form ini dua tombol simpan, dan yang tersembunyi
            tetap ikut urutan Tab. */}
        <Box
          w={{ base: '100%', lg: '260px' }}
          flexShrink={0}
          position="sticky"
          bottom={{ base: '0', lg: 'auto' }}
          top={{ base: 'auto', lg: '100px' }}
          zIndex="docked"
          // Di HP ia mengambang sedikit di atas tepi layar, bukan menempel rata
          // seperti bilah dulu: begitu isinya jadi kartu, bilah rata-tepi yang
          // berisi kartu berarti dua permukaan bertumpuk.
          mb={{ base: '16px', lg: '0' }}
        >
          {aside !== undefined && <Box mb="20px">{aside}</Box>}

          <Card variant="section" p={{ base: '16px', lg: '24px' }}>
            <Flex
              direction={{ base: 'row', lg: 'column' }}
              gap="12px"
              align={{ base: 'center', lg: 'stretch' }}
              justify="flex-end"
              wrap="wrap"
            >
              {formError !== '' && (
                <Text
                  role="alert"
                  flex={{ base: '1', lg: 'none' }}
                  minW={{ base: '200px', lg: '0' }}
                  order={{ base: 0, lg: 1 }}
                  fontSize="sm"
                  color="red.500"
                >
                  {formError}
                </Text>
              )}
              <Button
                type="submit"
                variant="brand"
                isLoading={busy}
                order={{ base: 2, lg: 0 }}
              >
                {submitLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                isDisabled={busy}
                order={{ base: 1, lg: 2 }}
              >
                Batal
              </Button>
            </Flex>
          </Card>

        </Box>
      </Flex>

      {leaveDialog}
    </form>
  )
}
