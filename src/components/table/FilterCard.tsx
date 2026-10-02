'use client'

import { SearchIcon } from '@chakra-ui/icons'
import { Box, Button, Card, Flex } from '@chakra-ui/react'
import type { PropsWithChildren } from 'react'

type FilterCardProps = PropsWithChildren<{
  /** Berapa saring yang benar-benar sedang memotong daftar. */
  activeCount: number
  onReset: () => void
  /**
   * Ada = saring ditahan sampai "Cari" (atau Enter) ditekan. Untuk daftar yang
   * besar: tiap ketikan dan tiap centang tidak memicu satu request.
   */
  onSubmit?: () => void
}>

/**
 * Kartu saring, di atas kartu tabel.
 *
 * Kartunya sendiri, dan itu bukan soal rapi: versi sebelumnya hidup DI DALAM
 * `Card variant="table"`, yang `overflowX: auto` + `overflowY: hidden`-nya
 * menjadikan kartu itu scroll container -- dan scroll container memotong
 * keturunan absolut-nya. Daftar dropdown tiap SelectField dipenggal tepat di
 * garis kepala tabel. `Card variant="section"` tidak punya `overflow` sama
 * sekali, jadi pemotongnya hilang bersama pindahnya.
 *
 * Pencarian TIDAK di sini: ia tinggal bersama tabelnya (TableSearch).
 *
 * Penyaringannya di klien, dan itu lengkap hari ini: `GET /resources` maupun
 * `GET /resources/{id}/units` tidak punya satu pun parameter query -- nol
 * pencarian, nol filter, nol paginasi, respons array telanjang.
 *
 * YANG MEMBATALKAN ITU: `04-api-spec.md:66` menjanjikan konvensi paginasi cursor
 * yang belum dipakai endpoint mana pun. Begitu salah satu daftar ini berhalaman,
 * seluruh penyaringan di sini berubah diam-diam jadi "cari di halaman yang
 * kebetulan termuat" -- dan saat itu ia harus pindah ke server.
 */
export function FilterCard({ activeCount, onReset, onSubmit, children }: FilterCardProps) {
  const aktif = activeCount > 0
  return (
    <Card variant="section" mb="20px" {...(onSubmit ? {
      as: 'form',
      onSubmit: (e: React.FormEvent) => { e.preventDefault(); onSubmit() },
    } : {})}>
      <Flex direction={{ base: 'column', md: 'row' }} align={{ md: 'flex-end' }} gap={{ base: '0', md: '20px' }}>
        <Box flex="1" minW="0">{children}</Box>

        {/* Hanya muncul kalau ada yang benar-benar menyaring. Di desktop ruangnya
            tetap dipesan, supaya field-nya tidak melebar-menyempit tiap kali
            saring pertama dipasang; di HP ia memang tidak punya baris. */}
        <Button
          type="button"
          variant="outline"
          h="48px"
          mb="20px"
          px="20px"
          borderRadius="16px"
          flexShrink={0}
          onClick={onReset}
          aria-label="Reset semua filter"
          aria-hidden={!aktif}
          tabIndex={aktif ? 0 : -1}
          visibility={aktif ? 'visible' : 'hidden'}
          display={{ base: aktif ? 'inline-flex' : 'none', md: 'inline-flex' }}
        >
          Reset ({activeCount})
        </Button>
        {onSubmit && (
          <Button type="submit" variant="brand" h="48px" mb="20px" px="24px" borderRadius="16px" flexShrink={0}
            leftIcon={<SearchIcon boxSize="14px" />}>
            Cari
          </Button>
        )}
      </Flex>
    </Card>
  )
}
