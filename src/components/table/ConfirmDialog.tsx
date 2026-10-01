'use client'

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from '@chakra-ui/react'
import { useRef } from 'react'

type ConfirmDialogProps = {
  isOpen: boolean
  title: string
  body: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Konfirmasi dua tombol, di berkasnya sendiri supaya bisa dimuat belakangan.
 *
 * Bentuknya menyalin dialog yang sudah ada di hooks/useUnsavedChanges.tsx: aksi
 * aman `brand` dan memegang leastDestructiveRef, aksi merusak `outline` merah.
 */
export function ConfirmDialog({
  isOpen,
  title,
  body,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onCancel} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent borderRadius="20px">
          <AlertDialogHeader fontSize="lg" fontWeight="700">
            {title}
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text fontSize="sm" color="text.secondary">
              {body}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter gap="12px">
            <Button ref={cancelRef} variant="brand" onClick={onCancel}>
              Batal
            </Button>
            <Button variant="outline" colorScheme="red" isLoading={busy} onClick={onConfirm}>
              Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}
