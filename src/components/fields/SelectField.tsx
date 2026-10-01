'use client'

import { ChevronDownIcon } from '@chakra-ui/icons'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId } from 'react'

export type SelectOption = {
  value: string
  label: string
  /** Baris kedua yang lebih kecil — untuk pilihan yang butuh penjelasan. */
  hint?: string
}

type SelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  isDisabled?: boolean
  helper?: string
  error?: string
}

/**
 * Dropdown yang dirender Chakra, bukan oleh sistem operasi.
 *
 * Dua hal yang hilang dibanding `<select>` bawaan, dan keduanya disengaja
 * bukan terlewat: di HP tidak ada lagi pemilih roda milik sistem, dan bagi
 * pembaca layar ini diumumkan sebagai menu, bukan sebagai isian form. Yang
 * didapat: satu rupa dropdown di seluruh form, bisa punya baris keterangan,
 * dan ikut mode gelap tanpa menumpang gaya milik peramban.
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  isDisabled = false,
  helper,
  error,
}: SelectFieldProps) {
  const labelId = useId()

  // Disalin nilai-per-nilai dari `Input.auth` di theme/components/input.ts:16px
  // radius, border 1px, dan pasangan warna ini. Kalau ia berubah di sana, ia
  // harus berubah di sini -- dan itu memang harga dari dropdown yang bukan
  // `<select>`, karena tema Chakra tidak punya slot untuk "Menu berbentuk field".
  const borderColor = useColorModeValue('secondaryGray.100', 'rgba(135, 140, 189, 0.3)')
  const selected = options.find((o) => o.value === value)

  return (
    <FormControl isInvalid={error !== undefined} mb="20px">
      <FormLabel id={labelId} ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
        {label}
      </FormLabel>

      {/* `flip={false}`: popper bawaan membalik daftar ke ATAS begitu ruang di
          bawahnya kurang, jadi field yang sama membuka ke arah berbeda
          tergantung posisi gulir. `maxH` di MenuList-lah yang membuat ruangnya
          cukup, bukan membaliknya. */}
      <Menu matchWidth flip={false}>
        <MenuButton
          // Tanpa ini ia submit form-nya saat dibuka.
          type="button"
          // MenuButton tidak punya asosiasi label bawaan seperti <select>.
          aria-labelledby={labelId}
          disabled={isDisabled}
          w="100%"
          h="48px"
          px="16px"
          textAlign="left"
          fontSize="sm"
          fontWeight="500"
          color="text.primary"
          bg="transparent"
          border="1px solid"
          borderColor={borderColor}
          borderRadius="16px"
          _hover={{ borderColor: 'brand.500' }}
          _focusVisible={{ boxShadow: 'outline' }}
          _disabled={{ opacity: 0.4, cursor: 'not-allowed' }}
        >
          <Text as="span" display="flex" alignItems="center" justifyContent="space-between" gap="8px">
            <Text as="span" noOfLines={1}>
              {selected?.label ?? '—'}
            </Text>
            <ChevronDownIcon boxSize="18px" flexShrink={0} color="text.secondary" />
          </Text>
        </MenuButton>

        {/* Tanpa maxH, daftar tahun (38 pilihan) tumbuh melewati tepi layar dan
            tidak bisa digulir sama sekali -- pilihan paling bawah tak
            terjangkau. */}
        <MenuList borderRadius="16px" py="8px" minW="0" maxH="280px" overflowY="auto">
          <MenuOptionGroup type="radio" value={value} onChange={(v) => onChange(v as string)}>
            {options.map((o) => (
              <MenuItemOption key={o.value} value={o.value} fontSize="sm">
                {o.label}
                {o.hint !== undefined && (
                  <Text fontSize="xs" color="text.secondary">
                    {o.hint}
                  </Text>
                )}
              </MenuItemOption>
            ))}
          </MenuOptionGroup>
        </MenuList>
      </Menu>

      {error !== undefined ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : (
        helper !== undefined && (
          <Text fontSize="xs" color="text.secondary" mt="6px" ms="4px">
            {helper}
          </Text>
        )
      )}
    </FormControl>
  )
}
