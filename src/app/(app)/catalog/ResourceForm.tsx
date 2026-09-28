'use client'

import {
  Button,
  Card,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  Switch,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId, useState } from 'react'

import { MoneyField } from 'components/fields/MoneyField'
import { useUnsavedChanges } from 'hooks/useUnsavedChanges'
import type { components } from 'lib/api/schema'

type Resource = components['schemas']['Resource']

export type ResourceDraft = {
  name: string
  category: string
  base_price: number | null
  deposit_amount: number | null
  late_fee_per_unit: number | null
  min_duration: number | null
  max_duration: number | null
  buffer_minutes: number | null
  requires_id_verification: boolean
  status: 'active' | 'inactive'
}

export function draftOf(resource?: Resource): ResourceDraft {
  return {
    name: resource?.name ?? '',
    category: resource?.category ?? '',
    base_price: resource?.base_price ?? null,
    deposit_amount: resource?.deposit_amount ?? null,
    late_fee_per_unit: resource?.late_fee_per_unit ?? null,
    min_duration: resource?.min_duration ?? null,
    max_duration: resource?.max_duration ?? null,
    buffer_minutes: resource?.buffer_minutes ?? 0,
    requires_id_verification: resource?.requires_id_verification ?? false,
    status: (resource?.status as 'active' | 'inactive') ?? 'active',
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
    Object.entries(fields).map(([field, detail]) => [field, EMPTY_INSTEAD_OF_ZERO[field] ?? detail]),
  )
}

type ResourceFormProps = {
  initial: ResourceDraft
  submitLabel: string
  busy: boolean
  errors: Record<string, string>
  formError: string
  /** Rendered only on the edit screen; a new resource is always born active. */
  showStatus?: boolean
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
  submitLabel,
  busy,
  errors,
  formError,
  showStatus,
  onSubmit,
  onCancel,
}: ResourceFormProps) {
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [localError, setLocalError] = useState('')
  const leaveDialog = useUnsavedChanges(dirty && !busy)

  const textColor = useColorModeValue('navy.700', 'white')
  const textColorSecondary = 'gray.400'
  const brandStars = useColorModeValue('brand.500', 'brand.400')

  function set<K extends keyof ResourceDraft>(key: K, value: ResourceDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
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
      <Card p="24px" mb="20px">
        <Text fontWeight="700" color={textColor} mb="16px">
          Barang
        </Text>

        <FormControl isInvalid={errors.name !== undefined} mb="20px">
          <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
            Nama
            <Text as="span" color={brandStars}>
              *
            </Text>
          </FormLabel>
          <Input
            isRequired
            variant="auth"
            fontSize="sm"
            size="lg"
            fontWeight="500"
            placeholder="Avanza 2021"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <FormErrorMessage>{errors.name}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={errors.category !== undefined} mb="20px">
          <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
            Kategori
          </FormLabel>
          <Input
            variant="auth"
            fontSize="sm"
            size="lg"
            fontWeight="500"
            placeholder="Mobil"
            value={draft.category}
            onChange={(e) => set('category', e.target.value)}
          />
          <FormErrorMessage>{errors.category}</FormErrorMessage>
        </FormControl>

        {showStatus && (
          <FormControl mb="4px">
            <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
              Status
            </FormLabel>
            <Select
              variant="auth"
              fontSize="sm"
              size="lg"
              fontWeight="500"
              value={draft.status}
              onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
            >
              <option value="active">Aktif — masih disewakan</option>
              <option value="inactive">Nonaktif — tidak ditawarkan lagi</option>
            </Select>
          </FormControl>
        )}
      </Card>

      <Card p="24px" mb="20px">
        <Text fontWeight="700" color={textColor} mb="4px">
          Harga &amp; jaminan
        </Text>
        <Text fontSize="xs" color={textColorSecondary} mb="16px">
          Harga dan deposit disalin ke booking saat dibuat. Mengubahnya di sini tidak menyentuh
          booking yang sudah jalan.
        </Text>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
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
            emptyMeans="Kosongkan kalau barang ini tidak pakai deposit. Jangan isi 0 — itu ditolak."
            value={draft.deposit_amount}
            onChange={(v) => set('deposit_amount', v)}
            error={errors.deposit_amount}
          />
          <MoneyField
            label="Denda telat per hari"
            nullable
            emptyMeans="Kosongkan kalau tidak ada denda. Peringatan telat tetap muncul."
            value={draft.late_fee_per_unit}
            onChange={(v) => set('late_fee_per_unit', v)}
            error={errors.late_fee_per_unit}
          />
        </SimpleGrid>
      </Card>

      <Card p="24px" mb="20px">
        <Text fontWeight="700" color={textColor} mb="16px">
          Aturan sewa
        </Text>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="0px 20px">
          <CountField
            label="Durasi minimum (hari)"
            nullable
            emptyMeans="Kosongkan kalau tidak ada batas bawah."
            value={draft.min_duration}
            onChange={(v) => set('min_duration', v)}
            error={errors.min_duration}
          />
          <CountField
            label="Durasi maksimum (hari)"
            nullable
            emptyMeans="Kosongkan kalau tidak ada batas atas."
            value={draft.max_duration}
            onChange={(v) => set('max_duration', v)}
            error={localError !== '' ? localError : errors.max_duration}
          />
          <CountField
            label="Jeda bersih-bersih (menit)"
            nullable={false}
            emptyMeans="Jeda wajib sesudah sewa berakhir sebelum unit yang sama bisa disewa lagi. 0 berarti tanpa jeda."
            value={draft.buffer_minutes}
            onChange={(v) => set('buffer_minutes', v ?? 0)}
            error={errors.buffer_minutes}
          />
        </SimpleGrid>

        <FormControl display="flex" alignItems="center" gap="12px" mt="4px">
          <Switch
            id="requires-id"
            colorScheme="brand"
            isChecked={draft.requires_id_verification}
            onChange={(e) => set('requires_id_verification', e.target.checked)}
          />
          <FormLabel htmlFor="requires-id" mb="0" fontSize="sm" fontWeight="500" color={textColor}>
            Wajib verifikasi identitas penyewa
          </FormLabel>
        </FormControl>
      </Card>

      <FormControl isInvalid={formError !== ''}>
        {formError !== '' && <FormErrorMessage mb="12px">{formError}</FormErrorMessage>}
      </FormControl>

      <Flex gap="12px">
        <Button type="submit" variant="brand" h="46px" isLoading={busy}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" h="46px" onClick={onCancel} isDisabled={busy}>
          Batal
        </Button>
      </Flex>

      {leaveDialog}
    </form>
  )
}

/**
 * A whole-number input with the same empty-is-not-zero rule as MoneyField, for
 * the two fields that are counts rather than money.
 */
function CountField({
  label,
  value,
  onChange,
  nullable,
  emptyMeans,
  error,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  nullable: boolean
  emptyMeans?: string
  error?: string
}) {
  const inputId = useId()
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorSecondary = 'gray.400'

  return (
    <FormControl isInvalid={error !== undefined} mb="20px">
      <FormLabel htmlFor={inputId} ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
        {label}
      </FormLabel>
      <Input
        id={inputId}
        variant="auth"
        fontSize="sm"
        size="lg"
        fontWeight="500"
        inputMode="numeric"
        placeholder={nullable ? 'Kosongkan kalau tidak berlaku' : '0'}
        value={value === null ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value.trim()
          if (raw === '') {
            onChange(null)
            return
          }
          // Integers only, and no parseFloat anywhere near it.
          if (!/^\d+$/.test(raw)) return
          onChange(Number(raw))
        }}
      />
      {error !== undefined ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : (
        emptyMeans && (
          <FormHelperText fontSize="xs" color={textColorSecondary}>
            {emptyMeans}
          </FormHelperText>
        )
      )}
    </FormControl>
  )
}
