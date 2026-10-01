'use client'

import { CloseIcon, SearchIcon } from '@chakra-ui/icons'
import {
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
  VisuallyHidden,
} from '@chakra-ui/react'
import { useId } from 'react'

type TableSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  resultCount: number
  totalCount: number
}

/**
 * Kotak cari, di kartu yang sama dengan tabelnya.
 *
 * Terpisah dari kartu saring: pencarian adalah cara membaca tabel yang sedang
 * dilihat, jadi ia tinggal bersama tabelnya. Pengumuman jumlah hasil ikut ke
 * sini karena ia menggambarkan tabel itu, bukan kontrol saringnya.
 *
 * Aman dari pemotongan: ia Input, bukan dropdown -- yang dipotong `overflow`
 * milik Card variant="table" hanya keturunan yang diposisikan absolut.
 */
export function TableSearch({
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
}: TableSearchProps) {
  const inputId = useId()

  return (
    <Flex p="16px 20px" justify="flex-end">
      <InputGroup maxW={{ base: '100%', md: '320px' }}>
        <InputLeftElement pointerEvents="none" h="100%">
          <SearchIcon color="text.secondary" boxSize="14px" />
        </InputLeftElement>
        <Input
          id={inputId}
          type="search"
          h="44px"
          borderRadius="12px"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value !== '' && (
          <InputRightElement h="100%">
            <IconButton
              type="button"
              aria-label="Bersihkan pencarian"
              icon={<CloseIcon boxSize="10px" />}
              size="sm"
              variant="ghost"
              borderRadius="8px"
              color="text.secondary"
              onClick={() => onChange('')}
            />
          </InputRightElement>
        )}
      </InputGroup>

      <VisuallyHidden aria-live="polite">
        <Text>
          {resultCount === totalCount
            ? `${totalCount} baris`
            : `${resultCount} dari ${totalCount} baris cocok`}
        </Text>
      </VisuallyHidden>
    </Flex>
  )
}
