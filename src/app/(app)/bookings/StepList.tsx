'use client'

import { CheckIcon } from '@chakra-ui/icons'
import { Box, Flex, ListItem, OrderedList, Text, VisuallyHidden, type BoxProps } from '@chakra-ui/react'

import type { PlanItem, PlanState } from './nextStep'

const STATUS: Record<PlanState, string> = { done: 'Selesai', current: 'Sekarang', upcoming: 'Berikutnya' }

/**
 * Urutan kerja satu booking: selesai / sekarang / berikutnya.
 *
 * Mendatar di layar lebar (bulatan sejajar, label di bawahnya, kalimat
 * langkah yang berjalan selebar kartu di bawah barisan), menurun di HP (enam
 * label tidak muat berdampingan di 390px). Batasnya `lg`, sama dengan Grid
 * dua kolom di bawahnya. Keduanya CSS saja -- tanpa useBreakpointValue, jadi
 * tanpa kedip saat SSR.
 *
 * Tiga keadaan dibedakan tiga cara sekaligus -- ikon centang vs nomor,
 * bulatan penuh vs bergaris, tebal vs biasa -- supaya tidak bergantung pada
 * warna saja. Pembaca layar mendapat katanya ("Sekarang: ...") lewat teks
 * tersembunyi dan `aria-current="step"`. Tanpa state dan tanpa animasi:
 * daftarnya cuma menggambar hasil `stepPlan`.
 */
export function StepList({ items, ...rest }: { items: PlanItem[] } & BoxProps) {
  const kini = items.find((it) => it.state === 'current')
  return (
    <Box {...rest}>
      <OrderedList styleType="none" ms="0" display={{ base: 'block', lg: 'flex' }} alignItems="flex-start">
        {items.map((it, i) => {
          const terakhir = i === items.length - 1
          const aktif = it.state === 'current'
          // Segmen sesudah langkah yang selesai ikut hijau; bulatannya yang
          // membawa artinya, garis cuma mengikuti.
          const garis = it.state === 'done' ? 'green.500' : 'border.strong'
          return (
            <ListItem key={it.key} display="flex" gap={{ base: '12px', lg: '8px' }} minW="0" position="relative"
              flexDirection={{ base: 'row', lg: 'column' }} alignItems={{ base: 'flex-start', lg: 'center' }}
              flex={{ lg: '1 1 0' }} px={{ lg: '4px' }} textAlign={{ base: 'left', lg: 'center' }}
              aria-current={aktif ? 'step' : undefined}
              // Garis mendatar ke bulatan berikutnya: dari tepi kanan bulatan
              // ini (50% + 14px + 4px) sampai 4px sebelum bulatan tetangga.
              // Kolomnya sama lebar (flex 1 1 0), jadi -50% dari tepi kanan
              // tepat jatuh di tengah kolom berikutnya.
              _after={terakhir ? undefined : {
                content: '""', position: 'absolute', top: '13px', h: '2px', borderRadius: 'full', bg: garis,
                left: 'calc(50% + 18px)', right: 'calc(-50% + 18px)',
                display: { base: 'none', lg: 'block' },
              }}>
              <Flex direction="column" align="center" flexShrink={0}>
                <Penanda state={it.state} nomor={i + 1} />
                {/* Garis menurun mengisi sisa tinggi item sampai bulatan
                    berikutnya. Jaraknya ditaruh di kolom teks (pb), bukan di li:
                    padding li tidak ikut diregang kolom ini. */}
                {!terakhir && (
                  <Box flex="1" minH="14px" w="2px" mt="4px" bg={garis} borderRadius="full" aria-hidden
                    display={{ base: 'block', lg: 'none' }} />
                )}
              </Flex>
              <Box pt={{ base: '3px', lg: '0' }} pb={{ base: terakhir ? '0' : '14px', lg: '0' }} minW="0">
                <Text lineHeight="1.4" fontWeight={aktif ? '700' : '500'} color={aktif ? 'text.primary' : 'text.secondary'}>
                  <VisuallyHidden>{STATUS[it.state]}: </VisuallyHidden>
                  {it.label}
                </Text>
                {it.note && <Text color="text.primary" mt="4px" display={{ base: 'block', lg: 'none' }}>{it.note}</Text>}
              </Box>
            </ListItem>
          )
        })}
      </OrderedList>
      {/* Di layar lebar kalimatnya selebar kartu, bukan terjepit di satu kolom
          ±150px. `display: none` menyembunyikan dari pembaca layar juga, jadi
          di tiap lebar kalimat ini terbaca sekali. */}
      {kini?.note && <Text color="text.primary" mt="16px" display={{ base: 'none', lg: 'block' }}>{kini.note}</Text>}
    </Box>
  )
}

function Penanda({ state, nomor }: { state: PlanState; nomor: number }) {
  const dasar = { w: '28px', h: '28px', borderRadius: 'full', align: 'center', justify: 'center', flexShrink: 0 } as const
  if (state === 'done') {
    return (
      <Flex {...dasar} bg="green.500" color="white">
        <CheckIcon boxSize="14px" aria-hidden />
      </Flex>
    )
  }
  if (state === 'current') {
    return (
      <Flex {...dasar} bg="brand.500" color="white" fontSize="sm" fontWeight="700" aria-hidden>
        {nomor}
      </Flex>
    )
  }
  return (
    <Flex {...dasar} borderWidth="2px" borderColor="border.strong" color="text.secondary" fontSize="sm" fontWeight="600" aria-hidden>
      {nomor}
    </Flex>
  )
}
