'use client'

import { Button, Card, Flex } from '@chakra-ui/react'
import type { PropsWithChildren } from 'react'

type FilterCardProps = PropsWithChildren<{
  /** Berapa saring yang benar-benar sedang memotong daftar. */
  activeCount: number
  onReset: () => void
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
export function FilterCard({ activeCount, onReset, children }: FilterCardProps) {
  return (
    <Card variant="section" mb="20px">
      {children}

      {/* Hanya muncul kalau ada yang benar-benar menyaring. */}
      {activeCount > 0 && (
        <Flex justify="flex-end">
          <Button type="button" variant="link" size="sm" colorScheme="brand" onClick={onReset}>
            Bersihkan semua filter
          </Button>
        </Flex>
      )}
    </Card>
  )
}
