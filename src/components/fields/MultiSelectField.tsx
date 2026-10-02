'use client'

import { ChevronDownIcon, SearchIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { useId, useState } from 'react'

import type { SelectOption } from 'components/fields/SelectField'

type MultiSelectFieldProps = {
  label: string
  /** Teks saat kosong, mis. "Semua penyewa". */
  placeholder: string
  options: SelectOption[]
  /**
   * Yang terpilih, lengkap dengan labelnya. Bukan sekadar id: dengan pencarian
   * di server, pilihan yang sudah dicentang bisa tidak ada lagi di `options`,
   * dan tombolnya tetap harus bisa menyebut namanya.
   */
  value: SelectOption[]
  onChange: (value: SelectOption[]) => void
  /** Ada = kotak cari tampil. Pemanggil yang memutuskan cari di server atau di klien. */
  onSearch?: (q: string) => void
  isLoading?: boolean
}

/**
 * Pilih beberapa: kotak berbentuk field, isinya daftar centang.
 *
 * Tidak memakai Menu seperti SelectField: Menu menutup diri setiap kali satu
 * item dipilih, dan memilih tiga penyewa berarti membukanya tiga kali. Tidak
 * diportal, dengan alasan yang sama dengan DateRangeField.
 */
export function MultiSelectField({
  label, placeholder, options, value, onChange, onSearch, isLoading = false,
}: MultiSelectFieldProps) {
  const labelId = useId()
  const [q, setQ] = useState('')
  const borderColor = useColorModeValue('secondaryGray.100', 'rgba(135, 140, 189, 0.3)')

  const dipilih = new Set(value.map((o) => o.value))
  // Yang sudah dicentang selalu di atas, termasuk yang tidak cocok dengan pencarian.
  const daftar = [...value, ...options.filter((o) => !dipilih.has(o.value))]
  const ringkas = value.length === 0
    ? placeholder
    : value.length === 1 ? value[0].label : `${value[0].label} +${value.length - 1}`

  function toggle(o: SelectOption) {
    onChange(dipilih.has(o.value) ? value.filter((v) => v.value !== o.value) : [...value, o])
  }

  return (
    <FormControl mb="20px">
      <FormLabel id={labelId} ms="4px" fontSize="sm" fontWeight="500" color="text.primary">{label}</FormLabel>
      <Popover placement="bottom-start" matchWidth isLazy>
        <PopoverTrigger>
          <Button type="button" aria-labelledby={labelId} variant="unstyled" display="flex" alignItems="center"
            justifyContent="space-between" gap="8px" w="100%" h="48px" px="16px" textAlign="left" fontSize="sm"
            fontWeight="500" color={value.length > 0 ? 'text.primary' : 'text.secondary'}
            border="1px solid" borderColor={borderColor} borderRadius="16px"
            _hover={{ borderColor: 'brand.500' }} _focusVisible={{ boxShadow: 'outline' }}>
            <Text as="span" noOfLines={1}>{ringkas}</Text>
            <ChevronDownIcon boxSize="18px" flexShrink={0} color="text.secondary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent w="100%" minW="240px" borderRadius="16px" _focusVisible={{ boxShadow: 'none' }}>
          <PopoverBody p="8px">
            {onSearch !== undefined && (
              <InputGroup size="sm" mb="6px">
                <InputLeftElement pointerEvents="none"><SearchIcon color="text.secondary" /></InputLeftElement>
                <Input value={q} placeholder="Cari…" borderRadius="10px" aria-label={`Cari ${label}`}
                  onChange={(e) => { setQ(e.target.value); onSearch(e.target.value) }} />
              </InputGroup>
            )}
            <Stack spacing="0" maxH="260px" overflowY="auto" role="group" aria-labelledby={labelId}>
              {daftar.map((o) => (
                <Checkbox key={o.value} isChecked={dipilih.has(o.value)} onChange={() => toggle(o)}
                  minH="40px" px="8px" borderRadius="8px" _hover={{ bg: 'surface.hover' }} colorScheme="brand">
                  <Text fontSize="sm" color="text.primary" noOfLines={1}>{o.label}</Text>
                </Checkbox>
              ))}
              {isLoading && <Box p="10px"><Spinner size="sm" /></Box>}
              {!isLoading && daftar.length === 0 && (
                <Text fontSize="sm" color="text.secondary" p="10px">Tidak ada yang cocok.</Text>
              )}
            </Stack>
            {value.length > 0 && (
              <Button type="button" variant="link" size="sm" colorScheme="brand" mt="6px" ms="8px" onClick={() => onChange([])}>
                Kosongkan
              </Button>
            )}
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </FormControl>
  )
}
