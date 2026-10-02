import { useState } from 'react'

/**
 * Dialog yang menutup dengan animasi.
 *
 * Pola `{x && <Dialog isOpen />}` melepas komponennya saat itu juga: overlay
 * gelap hilang dalam satu frame tanpa memudar, dan itu terlihat sebagai kedip.
 * Di sini `isOpen` dan isinya dipisah -- tutup hanya mematikan `isOpen`, isinya
 * baru dibuang lewat `onCloseComplete` sesudah Chakra selesai memudarkannya.
 */
export function useDialogState<T>() {
  const [value, setValue] = useState<T | null>(null)
  const [isOpen, setOpen] = useState(false)
  return {
    value,
    isOpen,
    open: (v: T) => {
      setValue(v)
      setOpen(true)
    },
    close: () => setOpen(false),
    onCloseComplete: () => setValue(null),
  }
}
