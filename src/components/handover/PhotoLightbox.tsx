'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import {
  Flex,
  IconButton,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'

export type LightboxPhoto = {
  /** URL gambar — bertanda tangan (galeri) atau object URL lokal (picker). */
  url: string
  caption?: string
  /** Tautan "buka ukuran penuh"; kosongkan untuk preview lokal. */
  href?: string
}

/**
 * Foto bukti dibuka di tempat, bukan di tab baru.  (S1-039)
 *
 * ‹ › dan panah keyboard menyusuri foto; Esc dan klik luar menutup (bawaan
 * Modal). Pemanggil memakai pola useDialogState supaya animasi tutupnya utuh.
 */
export function PhotoLightbox({ photos, initialIndex, isOpen, onClose, onCloseComplete }: {
  photos: LightboxPhoto[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  onCloseComplete?: () => void
}) {
  const [i, setI] = useState(initialIndex)
  // Dibuka ulang dari thumbnail lain = mulai dari foto itu, bukan posisi lama.
  useEffect(() => {
    if (isOpen) setI(initialIndex)
  }, [isOpen, initialIndex])
  const full = useBreakpointValue({ base: true, md: false }) ?? false

  const p = photos[Math.min(i, photos.length - 1)]
  if (!p) return null
  const geser = (d: number) => setI((x) => (x + d + photos.length) % photos.length)

  return (
    <Modal isOpen={isOpen} onClose={onClose} onCloseComplete={onCloseComplete}
      size={full ? 'full' : '4xl'} isCentered={!full}>
      <ModalOverlay bg="blackAlpha.800" />
      <ModalContent bg="transparent" boxShadow="none" borderRadius="0" my={full ? '0' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') geser(-1)
          if (e.key === 'ArrowRight') geser(1)
        }}>
        <ModalCloseButton color="white" bg="blackAlpha.600" _hover={{ bg: 'blackAlpha.700' }}
          borderRadius="full" zIndex={2} top="12px" right="12px" h="44px" w="44px" />
        <ModalBody p="0" position="relative" display="flex" alignItems="center" justifyContent="center"
          minH={full ? '100dvh' : '60vh'}>
          <Image src={p.url} alt={p.caption ?? 'Foto kondisi'} objectFit="contain"
            maxH={full ? '100dvh' : '82vh'} w="100%" />

          {photos.length > 1 && (
            <>
              <IconButton aria-label="Foto sebelumnya" icon={<ChevronLeftIcon boxSize="26px" />}
                onClick={() => geser(-1)} position="absolute" left="8px" top="50%" transform="translateY(-50%)"
                h="44px" w="44px" borderRadius="full" bg="blackAlpha.600" color="white" _hover={{ bg: 'blackAlpha.700' }} />
              <IconButton aria-label="Foto berikutnya" icon={<ChevronRightIcon boxSize="26px" />}
                onClick={() => geser(1)} position="absolute" right="8px" top="50%" transform="translateY(-50%)"
                h="44px" w="44px" borderRadius="full" bg="blackAlpha.600" color="white" _hover={{ bg: 'blackAlpha.700' }} />
            </>
          )}

          <Flex position="absolute" bottom="0" left="0" right="0" px="16px"
            py={full ? 'calc(10px + env(safe-area-inset-bottom))' : '10px'}
            bg="blackAlpha.700" justify="space-between" align="center" gap="12px">
            <Text fontSize="sm" color="white" noOfLines={1}>
              {photos.length > 1 ? `${i + 1}/${photos.length}` : ''}
              {photos.length > 1 && p.caption ? ' · ' : ''}
              {p.caption ?? ''}
            </Text>
            {p.href !== undefined && (
              <Link href={p.href} isExternal fontSize="sm" color="whiteAlpha.800" flexShrink={0}
                _hover={{ color: 'white' }}>
                Buka ukuran penuh
              </Link>
            )}
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
