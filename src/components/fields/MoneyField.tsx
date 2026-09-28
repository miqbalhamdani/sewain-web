'use client'

import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  InputGroup,
  InputLeftAddon,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId, useState } from 'react'

import { formatAmount, parseRupiah } from 'lib/format/money'

type MoneyFieldProps = {
  label: string
  value: number | null
  onChange: (value: number | null) => void

  /**
   * Whether empty is a meaningful answer.
   *
   * Required rather than defaulted, because the two cases behave in opposite
   * ways and the difference is BR-016. For `deposit_amount` and friends,
   * nullable is true and empty means the rule does not apply to this resource
   * -- emphatically not zero, which the database refuses. For `base_price`,
   * nullable is false and empty is simply missing.
   *
   * Defaulting it would make the safe-looking call the wrong one.
   */
  nullable: boolean

  /** The sentence that says what empty means here, in the owner's terms. */
  emptyMeans?: string
  error?: string
  isDisabled?: boolean
}

/**
 * A rupiah input.  (S1-018)
 *
 * Parses to an integer at the edge and keeps it integral all the way to the
 * API -- never parseFloat, never a float in state. What the person sees is
 * grouped (`350.000`); what leaves is a number (`350000`).
 */
export function MoneyField({
  label,
  value,
  onChange,
  nullable,
  emptyMeans,
  error,
  isDisabled,
}: MoneyFieldProps) {
  const inputId = useId()
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorSecondary = 'gray.400'
  // Hoisted: useColorModeValue is a hook, and calling it inside the `!nullable`
  // branch below would make it conditional.
  const brandStars = useColorModeValue('brand.500', 'brand.400')

  // The raw text is local so the person can type freely; the parsed number is
  // what the form holds. They resynchronise on blur, which is also where the
  // grouping appears -- regrouping on every keystroke moves the caret.
  const [raw, setRaw] = useState(value === null ? '' : formatAmount(value))

  return (
    <FormControl isInvalid={error !== undefined} mb="20px">
      <FormLabel htmlFor={inputId} ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
        {label}
        {!nullable && (
          <Text as="span" color={brandStars}>
            *
          </Text>
        )}
      </FormLabel>
      <InputGroup size="lg">
        <InputLeftAddon borderRadius="16px 0 0 16px" fontSize="sm" color={textColorSecondary}>
          Rp
        </InputLeftAddon>
        <Input
          id={inputId}
          variant="auth"
          fontSize="sm"
          fontWeight="500"
          inputMode="numeric"
          placeholder={nullable ? 'Kosongkan kalau tidak berlaku' : '0'}
          borderRadius="0 16px 16px 0"
          isDisabled={isDisabled}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            onChange(parseRupiah(e.target.value))
          }}
          onBlur={() => {
            const parsed = parseRupiah(raw)
            setRaw(parsed === null ? '' : formatAmount(parsed))
          }}
        />
      </InputGroup>
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
