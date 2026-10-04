'use client'

import { Box, Flex, Heading, Image, SimpleGrid, Spinner, Text } from '@chakra-ui/react'

import { PhotoLightbox, type LightboxPhoto } from 'components/handover/PhotoLightbox'
import { useDialogState } from 'hooks/useDialogState'
import { useQuery } from '@tanstack/react-query'

import { api } from 'lib/api/client'
import { formatDateTime } from 'lib/format/datetime'

const ARAH: Record<string, string> = { pickup: 'Saat diambil', return: 'Saat dikembalikan' }

/**
 * Bukti kondisi, hanya-baca.  (S1-039, BR-037)
 *
 * No delete, no replace, no edit -- for any role, the owner included. Evidence
 * a juragan can remove is evidence a renter can dispute; a correction is a
 * new note, never a change to an old one.
 */
export function HandoverGallery({ bookingId }: { bookingId: string }) {
  const lb = useDialogState<{ photos: LightboxPhoto[]; index: number }>()
  const { data, isPending } = useQuery({
    queryKey: ['bookings', bookingId, 'handovers'],
    // Signed URLs live an hour; refetch well before, not on every focus.
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}/handovers', { params: { path: { id: bookingId } } })
      if (error) throw error
      return data
    },
  })

  return (
    <Box>
      <Heading as="h2" size="sm" mb="12px">Bukti kondisi</Heading>
      {isPending && <Spinner size="sm" />}
      {data?.length === 0 && <Text fontSize="sm" color="text.secondary">Belum ada serah-terima.</Text>}
      {data?.map((h) => (
        <Box key={h.id} mb="16px">
          <Flex justify="space-between" wrap="wrap" gap="4px" mb="6px">
            <Text fontSize="sm" fontWeight="600" color="text.primary">{ARAH[h.direction] ?? h.direction}</Text>
            <Text fontSize="xs" color="text.secondary">{formatDateTime(h.performed_at)} · {h.performed_by}</Text>
          </Flex>
          {(h.meter_value !== null || Object.keys(h.checklist).length > 0) && (
            <Text fontSize="sm" color="text.secondary" mb="6px">
              {[h.meter_value !== null ? `Odometer ${h.meter_value.toLocaleString('id-ID')} km` : null,
                ...Object.entries(h.checklist).map(([k, v]) => `${k.replace('_', ' ')}: ${String(v)}`)]
                .filter(Boolean).join(' · ')}
            </Text>
          )}
          {h.condition_notes && <Text fontSize="sm" color="text.primary" mb="6px">{h.condition_notes}</Text>}
          {h.waiver_reason && (
            <Text fontSize="sm" color="text.secondary" mb="6px">Denda dibebaskan: {h.waiver_reason}</Text>
          )}
          <SimpleGrid columns={{ base: 3, md: 4 }} gap="6px">
            {h.photos.map((p) => (
              <Box key={p.id} as="button" type="button" borderRadius="8px" overflow="hidden"
                aria-label={`Lihat foto ${formatDateTime(p.captured_at)}`}
                _focusVisible={{ boxShadow: 'outline' }}
                onClick={() => lb.open({
                  photos: h.photos.map((x) => ({ url: x.url, caption: formatDateTime(x.captured_at), href: x.url })),
                  index: h.photos.indexOf(p),
                })}>
                <Image src={p.url} alt="Foto kondisi" objectFit="cover" w="100%" h="84px" />
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      ))}
      {lb.value && (
        <PhotoLightbox photos={lb.value.photos} initialIndex={lb.value.index}
          isOpen={lb.isOpen} onClose={lb.close} onCloseComplete={lb.onCloseComplete} />
      )}
    </Box>
  )
}
