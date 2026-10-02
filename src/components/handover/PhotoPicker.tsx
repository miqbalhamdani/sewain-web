'use client'

import { CloseIcon, RepeatIcon } from '@chakra-ui/icons'
import { Box, Button, Flex, IconButton, Image, Progress, SimpleGrid, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { MdPhotoCamera } from 'react-icons/md'

import { PhotoLightbox } from 'components/handover/PhotoLightbox'
import { useDialogState } from 'hooks/useDialogState'
import type { PhotoUpload } from 'hooks/usePhotoUpload'

const STATUS_CAPTION: Record<PhotoUpload['status'], string> = {
  uploading: 'Mengunggah…',
  done: 'Terunggah',
  error: 'Gagal terunggah',
}

/**
 * Camera-first photo field for handovers.  (S1-037)
 *
 * `capture="environment"` opens the back camera straight from the flow on a
 * phone; on a laptop it is an ordinary file picker. The "at least one photo"
 * rule is on screen from the start, not discovered on submit (BR-036).
 */
export function PhotoPicker({
  photos,
  onAdd,
  onRetry,
  onRemove,
  label = 'Foto kondisi unit',
}: {
  photos: PhotoUpload[]
  onAdd: (files: FileList) => File[]
  onRetry: (id: string) => void
  onRemove: (id: string) => void
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const lb = useDialogState<number>()
  const [refused, setRefused] = useState(0)
  const done = photos.filter((p) => p.status === 'done').length

  return (
    <Box>
      <Flex justify="space-between" align="baseline" mb="8px">
        <Text fontWeight="700" color="text.primary">{label}</Text>
        <Text fontSize="sm" color={done === 0 ? 'red.500' : 'text.secondary'}>
          {done === 0 ? 'Wajib minimal 1 foto' : `${done} foto terunggah`}
        </Text>
      </Flex>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) setRefused(onAdd(e.target.files).length)
          e.target.value = ''
        }}
      />
      <Button w="100%" h="56px" variant="outline" leftIcon={<MdPhotoCamera size="22px" />}
        onClick={() => input.current?.click()}>
        Ambil foto
      </Button>
      {refused > 0 && (
        <Text fontSize="sm" color="red.500" mt="6px">
          {refused} berkas dilewati — hanya JPG, PNG, atau WebP, maksimal 10 MB.
        </Text>
      )}

      {photos.length > 0 && (
        <SimpleGrid columns={3} gap="8px" mt="12px">
          {photos.map((p) => (
            <Box key={p.id} position="relative" borderRadius="10px" overflow="hidden" bg="surface.sunken">
              {/* Thumbnail-nya tombol: operator mengecek hasil jepretan di
                  lightbox. Tombol buang/ulang tetap di lapisan atasnya. */}
              <Box as="button" type="button" display="block" w="100%" aria-label="Lihat foto lebih besar"
                _focusVisible={{ boxShadow: 'outline' }} onClick={() => lb.open(photos.indexOf(p))}>
                <Image src={p.preview} alt="Foto kondisi" objectFit="cover" w="100%" h="96px" />
              </Box>
              {p.status === 'uploading' && (
                <Progress value={p.progress * 100} size="xs" position="absolute" bottom="0" left="0" right="0"
                  aria-label="Progres unggah" />
              )}
              {p.status === 'error' && (
                <Flex position="absolute" inset="0" bg="blackAlpha.600" align="center" justify="center">
                  <IconButton aria-label="Coba unggah lagi" icon={<RepeatIcon />} size="sm" onClick={() => onRetry(p.id)} />
                </Flex>
              )}
              <IconButton aria-label="Buang foto ini" icon={<CloseIcon boxSize="8px" />} size="xs"
                position="absolute" top="4px" right="4px" borderRadius="full" onClick={() => onRemove(p.id)} />
            </Box>
          ))}
        </SimpleGrid>
      )}
      {lb.value !== null && (
        <PhotoLightbox photos={photos.map((x) => ({ url: x.preview, caption: STATUS_CAPTION[x.status] }))}
          initialIndex={lb.value} isOpen={lb.isOpen} onClose={lb.close} onCloseComplete={lb.onCloseComplete} />
      )}
    </Box>
  )
}
