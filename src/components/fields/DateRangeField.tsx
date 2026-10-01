'use client'

import { CalendarIcon, CloseIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Icon,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react'
import { useId, type KeyboardEvent, type MouseEvent } from 'react'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

import { LazyCalendar } from 'components/fields/LazyCalendar'
import { formatDate, fromISODate, toISODate } from 'lib/format/datetime'


export type DateRange = { from: string; to: string }

type DateRangeFieldProps = {
  label: string
  /** Dua `YYYY-MM-DD`; keduanya string kosong berarti tidak menyaring. */
  value: DateRange
  onChange: (value: DateRange) => void
  helper?: string
}

/**
 * Rentang tanggal: satu kalender, dua ujung.
 *
 * Cangkangnya menyalin `DateField` -- termasuk alasan ia TIDAK memakai Portal:
 * popover yang diportal keluar dari pohon modal, dan focus-lock milik modal
 * menangkap pointer kalendernya. Bedanya satu prop, `selectRange`, jadi satu
 * kalender memilih dua tanggal alih-alih dua pemetik terpisah.
 */
export function DateRangeField({ label, value, onChange, helper }: DateRangeFieldProps) {
  const labelId = useId()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const borderColor = useColorModeValue('secondaryGray.100', 'rgba(135, 140, 189, 0.3)')
  const terisi = value.from !== '' && value.to !== ''
  const awal = fromISODate(value.from)
  const akhir = fromISODate(value.to)

  return (
    <FormControl mb="20px">
      <FormLabel id={labelId} ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
        {label}
      </FormLabel>

      <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-start">
        <PopoverTrigger>
          <Button
            type="button"
            aria-labelledby={labelId}
            variant="unstyled"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="8px"
            w="100%"
            h="48px"
            px="16px"
            textAlign="left"
            fontSize="sm"
            fontWeight="500"
            color={terisi ? 'text.primary' : 'text.secondary'}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="16px"
            _hover={{ borderColor: 'brand.500' }}
            _focusVisible={{ boxShadow: 'outline' }}
          >
            <Text as="span" noOfLines={1}>
              {terisi ? `${formatDate(value.from)} – ${formatDate(value.to)}` : 'Semua tanggal'}
            </Text>
            {terisi ? (
              <Box
                as="span"
                role="button"
                tabIndex={0}
                aria-label={`Bersihkan ${label}`}
                p="4px"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  onChange({ from: '', to: '' })
                }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange({ from: '', to: '' })
                  }
                }}
              >
                <CloseIcon boxSize="9px" color="text.secondary" />
              </Box>
            ) : (
              <CalendarIcon boxSize="14px" color="text.secondary" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent w="auto" borderRadius="20px" _focusVisible={{ boxShadow: 'none' }}>
          <PopoverBody p="12px" className="sewain-datepicker">{isOpen && (
            <LazyCalendar
              // react-calendar mengikuti locale peramban: tanpa ini navigasinya
              // berbahasa Inggris ("March 2027") di layar yang nilainya sendiri
              // sudah Indonesia ("1 Mar 2027").
              locale="id-ID"
              view="month"
              selectRange
              value={awal !== null && akhir !== null ? [awal, akhir] : null}
              onChange={(next: unknown) => {
                // selectRange memanggil onChange dua kali: sekali dengan satu
                // Date saat ujung pertama dipilih, lalu dengan pasangannya.
                // Hanya yang kedua yang berarti sebuah rentang.
                if (Array.isArray(next) && next[0] instanceof Date && next[1] instanceof Date) {
                  onChange({ from: toISODate(next[0]), to: toISODate(next[1]) })
                  onClose()
                }
              }}
              prevLabel={<Icon as={MdChevronLeft} w="20px" h="20px" />}
              nextLabel={<Icon as={MdChevronRight} w="20px" h="20px" />}
              prev2Label={null}
              next2Label={null}
            />
            )}
          </PopoverBody>
        </PopoverContent>
      </Popover>

      {helper !== undefined && (
        <Text fontSize="xs" color="text.secondary" mt="6px" ms="4px">
          {helper}
        </Text>
      )}
    </FormControl>
  )
}
