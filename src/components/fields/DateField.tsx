'use client'

import { CalendarIcon, CloseIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  IconButton,
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


type DateFieldProps = {
  label: string
  /** `YYYY-MM-DD`, atau string kosong untuk "belum diisi". */
  value: string
  onChange: (value: string) => void
  helper?: string
  error?: string
}

/**
 * Tanggal yang dirender aplikasi ini, bukan sistem operasi.
 *
 * `<input type="date">` sudah ikut tema pada kotaknya, tapi ikon dan kalender
 * popup-nya milik OS -- rupanya berbeda di Chrome, Safari, dan Windows, dan
 * tidak satu pun mengikuti design system ini.
 *
 * `react-calendar` dipakai karena ia SUDAH terpasang sejak template Horizon
 * (`styles/MiniCalendar.css` sudah diimpor global di AppWrappers), bukan karena
 * ia dipilih hari ini. Nol paket baru.
 *
 * Yang hilang dibanding native, dan itu disengaja: di HP tidak ada lagi roda
 * tanggal milik sistem. Imbalannya satu rupa kalender di semua tempat.
 */
export function DateField({ label, value, onChange, helper, error }: DateFieldProps) {
  const labelId = useId()
  const { isOpen, onOpen, onClose } = useDisclosure()

  // Disalin nilai-per-nilai dari `Input.auth` di theme/components/input.ts,
  // sama seperti SelectField -- tema Chakra tidak punya slot untuk "Popover
  // berbentuk field".
  const borderColor = useColorModeValue('secondaryGray.100', 'rgba(135, 140, 189, 0.3)')
  const terpilih = fromISODate(value)

  return (
    <FormControl isInvalid={error !== undefined} mb="20px">
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
            color={value === '' ? 'text.secondary' : 'text.primary'}
            border="1px solid"
            borderColor={error === undefined ? borderColor : 'red.500'}
            borderRadius="16px"
            _hover={{ borderColor: 'brand.500' }}
            _focusVisible={{ boxShadow: 'outline' }}
          >
            <Text as="span" noOfLines={1}>
              {value === '' ? 'Pilih tanggal' : formatDate(value)}
            </Text>
            {value === '' ? (
              <CalendarIcon boxSize="14px" color="text.secondary" />
            ) : (
              // Tanggal yang salah ketik harus bisa dikosongkan lagi, dan di
              // kontrak ketiganya memang `[string,"null"]`.
              <Box
                as="span"
                role="button"
                tabIndex={0}
                aria-label={`Kosongkan ${label}`}
                p="4px"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  onChange('')
                }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange('')
                  }
                }}
              >
                <CloseIcon boxSize="9px" color="text.secondary" />
              </Box>
            )}
          </Button>
        </PopoverTrigger>

        {/* TANPA Portal, dan itu disengaja. Field ini hidup di dalam Modal, dan
            popover yang diportal keluar dari pohon modal: focus-lock milik modal
            menangkap pointer-nya, jadi kalendernya TAMPIL tapi tidak bisa
            diklik sama sekali. Di dalam pohon modal ia ikut stacking dan
            focus-lock-nya. Syaratnya modal memakai scrollBehavior="outside",
            supaya badan modal tidak bikin konteks overflow yang memotongnya. */}
        <PopoverContent w="auto" borderRadius="20px" zIndex="popover" _focusVisible={{ boxShadow: 'none' }}>
            <PopoverBody p="12px" className="sewain-datepicker">{isOpen && (
              <LazyCalendar
                // react-calendar mengikuti locale peramban: tanpa ini navigasinya
                // berbahasa Inggris ("March 2027") di layar yang nilainya sendiri
                // sudah Indonesia ("1 Mar 2027").
                locale="id-ID"
                view="month"
                value={terpilih}
                onChange={(next: unknown) => {
                  if (next instanceof Date) {
                    onChange(toISODate(next))
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
