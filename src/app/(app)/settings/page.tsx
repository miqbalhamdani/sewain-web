'use client'

import {
  Alert, AlertDescription, AlertIcon, Button, Divider, Flex, FormControl, FormErrorMessage, FormHelperText,
  FormLabel, Input, SimpleGrid, Spinner, Switch, Text, Textarea, useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'

import { CountField } from 'components/fields/CountField'
import { FormSection } from 'components/fields/FormSection'
import { PageShell } from 'components/layout/PageShell'
import { api, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type Settings = components['schemas']['Settings']
type Update = components['schemas']['SettingsUpdate']

/**
 * Pengaturan usaha -- owner only.  (S1-066, S1-009, BR-003)
 *
 * Only the fields that changed are sent: PATCH leaves an absent key as it is,
 * and resending an unchanged slug would race nobody but still costs a lookup.
 */
export default function SettingsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await api.GET('/settings')
      if (error) throw error
      return data
    },
  })
  const [draft, setDraft] = useState<Settings | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof Settings | 'form', string>>>({})
  // Once, not on every refetch: with staleTime 0 a window-focus refetch would
  // otherwise wipe whatever the owner was in the middle of typing.
  useEffect(() => { if (query.data && draft === null) setDraft(query.data) }, [query.data, draft])

  const save = useMutation({
    mutationFn: async (body: Update) => {
      const { data, error } = await api.PATCH('/settings', { body })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data)
      setDraft(data)
      setErrors({})
      toast({ status: 'success', duration: 3000, title: 'Pengaturan disimpan' })
    },
    onError: (problem) => setErrors(messageFor(problem)),
  })

  if (query.isPending || !draft || !query.data) {
    return <PageShell title="Pengaturan" width="form"><Flex py="60px" justify="center"><Spinner size="lg" color="brand.500" /></Flex></PageShell>
  }
  const initial = query.data
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft({ ...draft, [k]: v })
  const changed = (Object.keys(draft) as (keyof Settings)[]).filter((k) => draft[k] !== initial[k])
  const blank = (s: string | null) => (s === null || s.trim() === '' ? null : s.trim())

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    const body: Record<string, unknown> = {}
    for (const k of changed) {
      const v = draft[k]
      body[k] = NULLABLE_TEXT.includes(k) ? blank(v as string | null) : v
    }
    save.mutate(body as Update)
  }

  const missing = [
    !initial.slug && 'alamat halaman',
    !initial.whatsapp && 'nomor WhatsApp',
    !initial.address && 'alamat usaha',
  ].filter(Boolean) as string[]

  return (
    <PageShell title="Pengaturan" subtitle="Aturan booking dan profil usaha. Hanya pemilik yang bisa mengubahnya." width="form">
      <form onSubmit={submit}>
        <FormSection title="Profil usaha" description="Tampil di halaman publik usaha kamu.">
          <Alert status={missing.length === 0 ? 'success' : 'info'} borderRadius="12px" mb="20px">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              {missing.length === 0
                ? 'Profil lengkap. Halaman publik tayang begitu fiturnya dirilis.'
                : `Halaman publik belum bisa tayang: ${missing.join(', ')} belum diisi.`}
            </AlertDescription>
          </Alert>
          <Field label="Alamat halaman" error={errors.slug}
            helper={`Huruf kecil, angka, dan tanda hubung. Halamanmu: ${draft.slug ?? 'nama-usaha'}.sewain.id`}>
            <Input value={draft.slug ?? ''} onChange={(e) => set('slug', e.target.value.toLowerCase() || null)} placeholder="rental-budi" autoComplete="off" />
          </Field>
          <Field label="Nomor WhatsApp" error={errors.whatsapp} helper="Diawali +62. Penyewa menghubungi kamu lewat nomor ini.">
            <Input value={draft.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value || null)} placeholder="+628123456789" inputMode="tel" />
          </Field>
          <Field label="Alamat usaha" error={errors.address}>
            <Textarea value={draft.address ?? ''} onChange={(e) => set('address', e.target.value || null)} rows={2} />
          </Field>
          <Field label="Jam operasional" error={errors.operating_hours}>
            <Input value={draft.operating_hours ?? ''} onChange={(e) => set('operating_hours', e.target.value || null)} placeholder="Senin–Sabtu 08.00–20.00" />
          </Field>
        </FormSection>

        <FormSection title="Aturan booking">
          <Field label="Awalan kode booking" error={errors.booking_code_prefix}
            helper="2–6 huruf besar atau angka. Kode yang sudah terbit tidak ikut berubah.">
            <Input value={draft.booking_code_prefix} maxLength={6}
              onChange={(e) => set('booking_code_prefix', e.target.value.toUpperCase())} />
          </Field>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="0 20px">
            <CountField label="Draft hangus (jam)" nullable={false} value={draft.draft_expiry_hours}
              onChange={(v) => set('draft_expiry_hours', v ?? 0)} error={errors.draft_expiry_hours} />
            <CountField label="Tenggat bayar (jam)" nullable={false} value={draft.payment_due_hours}
              onChange={(v) => set('payment_due_hours', v ?? 0)} error={errors.payment_due_hours} />
            <CountField label="Toleransi tidak datang (jam)" nullable={false} value={draft.no_show_tolerance_hours}
              onChange={(v) => set('no_show_tolerance_hours', v ?? 0)} error={errors.no_show_tolerance_hours} />
          </SimpleGrid>
          <Toggle id="pay-first" checked={draft.require_payment_before_pickup} onChange={(v) => set('require_payment_before_pickup', v)}
            label="Wajib lunas sebelum unit diambil"
            hint="Kalau aktif, booking yang belum dibayar sampai tenggat dibatalkan otomatis dan unitnya dilepas." />
        </FormSection>

        <FormSection title="Pengingat WhatsApp" description="Berlaku setelah WhatsApp tersambung — fitur ini menyusul.">
          <Toggle id="n-pickup" checked={draft.notify_pickup_reminder} onChange={(v) => set('notify_pickup_reminder', v)}
            label="Ingatkan penyewa sebelum jadwal ambil" />
          <Toggle id="n-return" checked={draft.notify_return_reminder} onChange={(v) => set('notify_return_reminder', v)}
            label="Ingatkan penyewa sebelum jadwal kembali" />
          <Toggle id="n-overdue" checked={draft.notify_overdue_reminder} onChange={(v) => set('notify_overdue_reminder', v)}
            label="Kabari penyewa yang terlambat" />
        </FormSection>

        {errors.form && <Text color="red.500" fontSize="sm" mb="12px" role="alert">{errors.form}</Text>}
        <Flex justify="flex-end" gap="12px" mb="40px">
          <Button variant="outline" isDisabled={changed.length === 0 || save.isPending} onClick={() => { setDraft(initial); setErrors({}) }}>Batalkan perubahan</Button>
          <Button type="submit" variant="brand" isDisabled={changed.length === 0} isLoading={save.isPending}>Simpan</Button>
        </Flex>
      </form>
    </PageShell>
  )
}

function Field({ label, error, helper, children }: { label: string; error?: string; helper?: string; children: ReactNode }) {
  return (
    <FormControl isInvalid={error !== undefined} mb="20px">
      <FormLabel ms="4px" fontSize="sm" fontWeight="500" color="text.primary">{label}</FormLabel>
      {children}
      {error ? <FormErrorMessage>{error}</FormErrorMessage> : helper && <FormHelperText fontSize="xs">{helper}</FormHelperText>}
    </FormControl>
  )
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <>
      <Divider borderColor="border.subtle" my="12px" />
      <FormControl display="flex" alignItems="flex-start" gap="12px">
        <Switch id={id} colorScheme="brand" mt="2px" isChecked={checked} onChange={(e) => onChange(e.target.checked)} />
        <FormLabel htmlFor={id} mb="0" fontSize="sm" fontWeight="500" color="text.primary">
          {label}
          {hint && <Text as="span" display="block" fontSize="xs" fontWeight="400" color="text.secondary">{hint}</Text>}
        </FormLabel>
      </FormControl>
    </>
  )
}

// Text fields where blank means "not set": sent trimmed, or null.
const NULLABLE_TEXT: (keyof Settings)[] = ['whatsapp', 'address', 'operating_hours']

/** The API speaks English details; the owner reads Indonesian next to the field. */
function messageFor(problem: unknown): Partial<Record<keyof Settings | 'form', string>> {
  const code = problemCode(problem)
  if (code === 'slug-taken') return { slug: 'Alamat ini sudah dipakai usaha lain.' }
  if (code === 'slug-invalid') return { slug: '3–63 huruf kecil, angka, atau tanda hubung; tidak diawali/diakhiri tanda hubung, dan bukan nama yang dicadangkan.' }
  const detail = (problem as { detail?: string } | null)?.detail ?? ''
  if (detail.includes('WhatsApp')) return { whatsapp: 'Diawali +62 lalu 8–13 digit, contoh +628123456789.' }
  if (detail.includes('booking_code_prefix')) return { booking_code_prefix: '2–6 huruf besar atau angka.' }
  if (detail.includes('payment_due_hours')) return { payment_due_hours: 'Minimal 1 jam.' }
  return { form: 'Pengaturan gagal disimpan. Coba lagi.' }
}
