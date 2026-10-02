'use client'

import { Box, Button, Flex, FormControl, FormErrorMessage, FormLabel, Input, Text, Textarea, Wrap } from '@chakra-ui/react'

import type { ChecklistItem } from './checklist'

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
          <Input type="number" inputMode="numeric" h="52px" fontSize="lg" value={meter}
            onChange={(e) => onMeter(e.target.value)} placeholder="45120" />
          <FormErrorMessage>{meterError}</FormErrorMessage>
        </FormControl>
      )}
      {items.map((item) => (
        <Box key={item.key} mt="16px">
          <Text fontSize="sm" fontWeight="600" color="text.primary" mb="6px">{item.label}</Text>
          <Wrap spacing="8px">
            {item.options.map((o) => (
              <Button key={o} size="md" h="44px" variant={checklist[item.key] === o ? 'brand' : 'outline'}
                aria-pressed={checklist[item.key] === o} onClick={() => onChecklist(item.key, o)}>
                {o}
              </Button>
            ))}
          </Wrap>
        </Box>
      ))}
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
