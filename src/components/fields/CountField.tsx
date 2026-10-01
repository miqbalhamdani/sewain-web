'use client'

import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId } from 'react'

/**
 * A whole-number input with the same empty-is-not-zero rule as MoneyField, for
 * the fields that are counts rather than money.
 *
 * It lived inside ResourceForm until S1-087 gave it a fourth caller (jumlah
 * kursi) on a different card. Same shape as MoneyField minus the Rp addon and
 * the raw/parsed split -- a number does not need regrouping on blur.
 */
export function CountField({
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
        inputMode="numeric"
        // Same reason as MoneyField: `emptyMeans` says it once already.
        placeholder={nullable ? '—' : '0'}
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
