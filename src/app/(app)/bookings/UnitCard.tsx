'use client'

import { CheckCircleIcon } from '@chakra-ui/icons'
import { Box, Flex, Text, useRadio, type UseRadioProps } from '@chakra-ui/react'

import type { components } from 'lib/api/schema'

type Unit = components['schemas']['UnitRef']

export const unitName = (u: Unit) => u.label ?? u.code

/** Dua kartu sebaris di HP; di layar lebar sebanyak yang muat, minimal 180px. */
export const UNIT_GRID = { base: 'repeat(2, 1fr)', md: 'repeat(auto-fill, minmax(180px, 1fr))' }

/**
 * Satu unit sebagai kartu pilihan. Input radio aslinya tetap ada (disembunyikan),
 * jadi panah keyboard dan pembaca layar bekerja seperti RadioGroup biasa. Terpilih
 * ditandai border + ikon centang, bukan warna saja.
 */
export function UnitCard({ unit, ...props }: UseRadioProps & { unit: Unit }) {
  const { getInputProps, getRadioProps, state } = useRadio(props)
  return (
    <Box as="label" cursor="pointer">
      <input {...getInputProps({ 'aria-label': unit.label ? `${unit.label} (${unit.code})` : unit.code })} />
      <Flex {...getRadioProps()} align="center" justify="space-between" gap="10px" minH="60px" px="14px" py="10px"
        borderWidth="2px" borderRadius="12px" borderColor="border.subtle" transition="border-color .15s ease, background-color .15s ease"
        _hover={{ borderColor: 'brand.300' }}
        _checked={{ borderColor: 'brand.500', bg: 'brand.50', _dark: { bg: 'whiteAlpha.100' } }}
        _focusVisible={{ boxShadow: 'outline' }}>
        <Box minW="0">
          <Text fontWeight="700" color="text.primary" noOfLines={1}>{unitName(unit)}</Text>
          {unit.label && <Text fontSize="xs" color="text.secondary" noOfLines={1}>{unit.code}</Text>}
        </Box>
        {state.isChecked && <CheckCircleIcon color="brand.500" boxSize="18px" aria-hidden />}
      </Flex>
    </Box>
  )
}
