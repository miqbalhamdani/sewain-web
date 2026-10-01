'use client'

import { ChevronDownIcon } from '@chakra-ui/icons'
import { Box, Button, Card, Text } from '@chakra-ui/react'
import { useId, useState, type PropsWithChildren } from 'react'

type FormSectionProps = PropsWithChildren<{
  title: string
  /** Satu kalimat. Kalau butuh dua, isinya milik helper field, bukan kartunya. */
  description?: string

  /**
   * Kartu yang isinya opsional boleh dilipat. Yang wajib diisi tidak: menyembunyikan
   * field yang harus diisi cuma memindahkan pekerjaannya, tidak menguranginya.
   */
  collapsible?: boolean

  /**
   * Terbuka sejak awal. Pemanggil menghitungnya dari isinya — kartu yang sudah
   * ada isinya tidak boleh menyembunyikan tulisan juragan sendiri.
   */
  defaultOpen?: boolean
}>

/**
 * Satu kartu di form backoffice: judul, keterangan opsional, lalu field-nya.
 *
 * Ada karena pola yang sama ditulis ulang tujuh kali di dua layar katalog,
 * masing-masing dengan jarak judul yang sedikit berbeda.
 */
export function FormSection({
  title,
  description,
  collapsible = false,
  defaultOpen = false,
  children,
}: FormSectionProps) {
  const regionId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = !collapsible || open

  // p dibuang dari sini: varian `Card.section` sudah memberi 24px sejak card.ts
  // diperbaiki, dan dua nilai untuk satu hal cuma menunggu jadi berbeda.
  return (
    <Card mb="20px">
      {collapsible ? (
        <Button
          // Wajib: <button> di dalam <form> default-nya submit, jadi melipat
          // sebuah kartu akan menyimpan barangnya.
          type="button"
          variant="link"
          aria-expanded={isOpen}
          aria-controls={regionId}
          onClick={() => setOpen((v) => !v)}
          leftIcon={
            <ChevronDownIcon
              boxSize="20px"
              transition="transform .15s ease"
              transform={isOpen ? undefined : 'rotate(-90deg)'}
            />
          }
          // Digaya seperti judul kartu yang digantikannya, bukan seperti tautan.
          color="text.primary"
          fontWeight="700"
          fontSize="md"
          justifyContent="flex-start"
          w="100%"
          mb={isOpen ? (description ? '4px' : '16px') : '0'}
          _hover={{ color: 'brand.500' }}
        >
          {title}
        </Button>
      ) : (
        <Text fontWeight="700" color="text.primary" mb={description ? '4px' : '16px'}>
          {title}
        </Text>
      )}

      {/* Wrapper-nya selalu dirender supaya aria-controls di atas tidak pernah
          menunjuk id yang hilang; isinya yang kondisional. */}
      <Box id={regionId}>
        {isOpen && (
          <>
            {description && (
              <Text fontSize="xs" color="text.secondary" mb="16px">
                {description}
              </Text>
            )}
            {children}
          </>
        )}
      </Box>
    </Card>
  )
}
