'use client'

import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  Stack,
  StackDivider,
  Text,
  Textarea,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import {
  MdArticle,
  MdBuild,
  MdLocalGasStation,
  MdSportsMotorsports,
  MdTireRepair,
  MdUmbrella,
} from 'react-icons/md'

import type { ChecklistItem } from './checklist'

/** Ikon per item -- presentasi, bukan data: checklist.ts tetap polos. */
const IKON: Record<string, IconType> = {
  bensin: MdLocalGasStation,
  ban_serep: MdTireRepair,
  dongkrak: MdBuild,
  stnk: MdArticle,
  helm: MdSportsMotorsports,
  jas_hujan: MdUmbrella,
}

/**
 * Odometer, checklist and note -- shared by pickup and return.  (S1-037)
 *
 * Chips, not dropdowns: a tap each with one thumb, standing in a parking lot.
 */
export function HandoverFields({
  isVehicle,
  meter,
  onMeter,
  meterError,
  items,
  checklist,
  onChecklist,
  notes,
  onNotes,
}: {
  isVehicle: boolean
  meter: string
  onMeter: (v: string) => void
  meterError?: string
  items: ChecklistItem[]
  checklist: Record<string, string>
  onChecklist: (key: string, value: string) => void
  notes: string
  onNotes: (v: string) => void
}) {
  return (
    <>
      {isVehicle && (
        <FormControl isInvalid={meterError !== undefined} mt="20px">
          <FormLabel fontWeight="700" color="text.primary">Odometer (km)</FormLabel>
          {/* Teks + saring digit, bukan type="number": number menerima "-" dan "e",
              dan odometer minus bukan angka yang pernah benar. */}
          <Input type="text" inputMode="numeric" pattern="[0-9]*" h="52px" fontSize="lg" value={meter}
            onChange={(e) => onMeter(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="45120" />
          <FormErrorMessage>{meterError}</FormErrorMessage>
        </FormControl>
      )}
      {items.length > 0 && (
        <Stack mt="16px" spacing="12px" divider={<StackDivider borderColor="border.subtle" />}>
          {items.map((item) => {
            const lebar = item.options.length > 3
            const label = (
              <Flex align="center" gap="8px" minW="0">
                {IKON[item.key] && <Icon as={IKON[item.key]} boxSize="18px" color="text.secondary" aria-hidden />}
                <Text fontSize="sm" fontWeight="600" color="text.primary">{item.label}</Text>
              </Flex>
            )
            // Segmented, pola tab status /customers: terpilih brand, sisanya
            // outline. Bensin (5 opsi) selebar kartu; "Hampir habis" melipat
            // dua baris di HP alih-alih meledakkan lebar.
            const segmented = (
              <ButtonGroup isAttached variant="outline" size="sm" role="group" aria-label={item.label}
                w={lebar ? '100%' : undefined}>
                {item.options.map((o) => (
                  <Button key={o} type="button" minH="44px" px={lebar ? '4px' : '14px'}
                    {...(lebar ? { flex: 1, minW: 0, h: 'auto', whiteSpace: 'normal', lineHeight: 1.15, fontSize: 'sm' } : {})}
                    aria-pressed={checklist[item.key] === o}
                    onClick={() => onChecklist(item.key, o)}
                    {...(checklist[item.key] === o ? { variant: 'brand', zIndex: 1 } : { color: 'text.secondary' })}>
                    {o}
                  </Button>
                ))}
              </ButtonGroup>
            )
            return lebar ? (
              <Box key={item.key}>
                <Box mb="8px">{label}</Box>
                {segmented}
              </Box>
            ) : (
              <Flex key={item.key} justify="space-between" align="center" wrap="wrap" gap="8px">
                {label}
                {segmented}
              </Flex>
            )
          })}
        </Stack>
      )}
      <FormControl mt="16px">
        <FormLabel fontSize="sm" fontWeight="600" color="text.primary">Catatan kondisi</FormLabel>
        <Textarea value={notes} onChange={(e) => onNotes(e.target.value)} maxLength={1000}
          placeholder="Baret halus di bemper belakang." />
      </FormControl>
    </>
  )
}

/** The primary action, pinned to the bottom of the screen within thumb reach. */
export function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <Flex position="sticky" bottom="0" mt="24px" py="12px" gap="10px" bg="secondaryGray.300"
      _dark={{ bg: 'navy.900' }} zIndex={2}>
      {children}
    </Flex>
  )
}
