'use client'

import { Box, Flex, Text } from '@chakra-ui/react'
import type { PropsWithChildren, ReactNode } from 'react'

import { useSetPageHeader, type Crumb } from 'contexts/PageHeaderContext'

type PageShellProps = PropsWithChildren<{
  title: string
  subtitle?: string
  /** Aksi utama halaman, rata kanan di layar lebar, turun sendiri di sempit. */
  action?: ReactNode
  /**
   * `form` mengunci lebar baca 880px; `form-aside` melebarkannya jadi 1180px
   * untuk form yang punya kolom aksi di sebelahnya; `list` membiarkan tabel
   * memakai seluruh kolom. Dulu ini ditebak per halaman: `units` 880px,
   * `catalog` tanpa batas, tanpa alasan yang ditulis.
   */
  width?: 'form' | 'form-aside' | 'list'

  /**
   * Jejak di navbar, tanpa segmen terakhir — judul halaman ini yang jadi
   * segmen itu, dan ia sudah ada di `title`.
   */
  breadcrumb?: Crumb[]
}>

/**
 * Kerangka satu halaman backoffice: jarak dari navbar, lebar konten, dan
 * header judul/subjudul/aksi.
 *
 * Ada karena blok header yang sama ditulis tiga kali di tiga berkas, dan
 * `pt={{ base: '130px', md: '80px', xl: '80px' }}` enam kali di enam berkas.
 * Angka itu mengosongkan ruang untuk navbar yang mengambang di portal, dan
 * halaman yang lupa menuliskannya dirender DI BAWAH navbar-nya. Sekarang ia
 * hidup di satu tempat dan halaman berhenti tahu soal navbar.
 *
 * Judulnya tidak dirender di sini: ia disetor ke navbar lewat
 * PageHeaderContext, dan navbar yang memegang satu-satunya h1. Dua judul di
 * satu layar -- 34px di navbar dan 28px di sini -- adalah pertanyaan "yang mana
 * judul halamannya" yang tidak punya jawaban.
 */
const MAX_W: Record<NonNullable<PageShellProps['width']>, string | undefined> = {
  form: '880px',
  // 1180 bukan angka bulat yang enak: ia lebar tersempit yang masih memuat
  // kolom form 560px + jarak 20px + panel aksi 260px pada layar 1200px, tempat
  // sidebar 290px baru muncul dan konten justru menyempit.
  'form-aside': '1180px',
  list: undefined,
}

export function PageShell({
  title,
  subtitle,
  action,
  width = 'list',
  breadcrumb = [],
  children,
}: PageShellProps) {
  useSetPageHeader(title, [...breadcrumb, { label: title }])

  return (
    <Box
      pt={{ base: '130px', md: '80px' }}
      maxW={MAX_W[width]}
      mx={width === 'list' ? undefined : 'auto'}
    >
      {(subtitle !== undefined || action !== undefined) && (
        <Flex align="center" justify="space-between" mb="24px" gap="16px" wrap="wrap">
          {subtitle !== undefined ? (
            <Text color="text.secondary" fontSize="sm">
              {subtitle}
            </Text>
          ) : (
            <Box />
          )}
          {action}
        </Flex>
      )}
      {children}
    </Box>
  )
}
