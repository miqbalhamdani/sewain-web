'use client'

import { IconButton, Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react'
import dynamic from 'next/dynamic'
import { useState } from 'react'

/**
 * Dimuat saat tombol Hapus ditekan, bukan saat tabelnya dirender.
 *
 * `AlertDialog` menyeret serta modal, focus-lock, dan transisi framer-motion --
 * +73 kB First Load JS di layar daftar yang sebelumnya tidak punya dialog sama
 * sekali (terukur: /catalog 149 -> 222 kB). Yang tidak pernah menekan Hapus
 * tidak perlu mengunduhnya.
 */
const ConfirmDialog = dynamic(
  () => import('components/table/ConfirmDialog').then((m) => m.ConfirmDialog),
  { ssr: false },
)

type RowActionsProps = {
  /** Nama aksesibilitas tombolnya — ia ikon saja, jadi tanpa ini ia bisu. */
  label: string

  /**
   * Hilangkan (biarkan `undefined`) kalau peran ini tidak boleh melakukannya.
   *
   * Disembunyikan, bukan dinonaktifkan: tombol mati yang tetap `403` mengiklankan
   * kemampuan yang tidak dimiliki pengguna dan melahirkan pertanyaan ke support
   * (BR-003). Kalau keduanya kosong, tombol tiga titiknya sendiri tidak dirender.
   */
  onEdit?: () => void
  onDelete?: () => void

  editLabel?: string
  deleteTitle: string
  deleteBody: string
  busy?: boolean
}

/**
 * Menu aksi satu baris tabel, beserta konfirmasi hapusnya.
 *
 * Konfirmasinya tinggal di sini, bukan di komponen keempat: hapus adalah
 * satu-satunya aksi merusak di menu ini, dan menaruh dialognya di luar berarti
 * tiap tabel mengurus state dialognya sendiri — dua tabel, dua kesempatan lupa.
 *
 * Penting untuk kedua jalur hapusnya: server **tidak pernah menolak** karena ada
 * booking (nol respons `409` di kontrak), jadi dialog ini satu-satunya rem yang
 * ada. Kalimatnya harus menyebut akibatnya, bukan cuma bertanya "yakin?".
 */
export function RowActions({
  label,
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteTitle,
  deleteBody,
  busy = false,
}: RowActionsProps) {
  const [confirming, setConfirming] = useState(false)

  if (onEdit === undefined && onDelete === undefined) return null

  return (
    <>
      {/* Ke bawah, konsisten dengan SelectField: menu yang membuka ke atas di
          baris terakhir dan ke bawah di baris pertama adalah dua perilaku untuk
          satu kontrol. */}
      <Menu placement="bottom-end" flip={false}>
        <MenuButton
          as={IconButton}
          // Wajib di dalam <form>; tabel ini bukan form, tapi komponennya
          // berkeliling dan default `submit` adalah jebakan yang mahal.
          type="button"
          aria-label={label}
          icon={<TigaTitik />}
          variant="ghost"
          // 44px meski ikonnya 20px: ini target sentuh, bukan ukuran gambar.
          minW="44px"
          h="44px"
          borderRadius="12px"
          color="text.secondary"
          _hover={{ color: 'text.primary', bg: 'surface.hover' }}
          _active={{ bg: 'surface.hover' }}
        />
        {/* Di Portal, dan di sini itu WAJIB: menu ini hidup di dalam sel tabel,
            jadi di dalam `Card variant="table"` yang `overflowX: auto` +
            `overflowY: hidden`-nya menjadikan kartu itu scroll container --
            dan scroll container memotong keturunan absolut-nya. Daftar saring
            bisa dipindah keluar kartu; baris tabel tidak bisa.

            Kebalikan dari DateField, yang justru TIDAK boleh diportal karena ia
            hidup di dalam Modal dan focus-lock modal menangkap pointer-nya.
            RowActions tidak pernah berada di dalam modal. */}
        <Portal>
          <MenuList minW="180px">
            {onEdit !== undefined && (
              <MenuItem onClick={onEdit} isDisabled={busy}>
                {editLabel}
              </MenuItem>
            )}
            {onDelete !== undefined && (
              <MenuItem onClick={() => setConfirming(true)} isDisabled={busy} color="red.500">
                Hapus
              </MenuItem>
            )}
          </MenuList>
        </Portal>
      </Menu>

      {confirming && (
        <ConfirmDialog
          isOpen
          title={deleteTitle}
          body={deleteBody}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onDelete?.()
          }}
        />
      )}
    </>
  )
}

/**
 * Tiga titik, digambar di tempat.
 *
 * Bukan dari `react-icons`: satu ikon dari barrel `react-icons/md` berharga
 * ~2 kB di sini -- kecil, tapi tiga lingkaran memang tidak butuh dependensi.
 */
function TigaTitik() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="4" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="10" cy="16" r="1.6" />
    </svg>
  )
}
