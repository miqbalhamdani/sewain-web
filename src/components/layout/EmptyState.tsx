'use client'

import { Card, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  /** Langkah berikutnya, bukan status. Satu kalimat. */
  description: string
  action?: ReactNode
}

/**
 * Keadaan kosong yang jujur.
 *
 * `role="status"` supaya perpindahan dari memuat ke kosong diumumkan; dua versi
 * sebelumnya adalah `<Card>` biasa, jadi pembaca layar tidak diberi tahu apa pun
 * saat spinner berhenti.
 *
 * `action` opsional tapi disarankan: layar unit dulu menyatakan masalah
 * ("belum bisa dibooking") lalu berhenti, padahal formnya ada tepat di atasnya.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card variant="panel" role="status">
      <Text fontWeight="700" color="text.primary" mb="6px">
        {title}
      </Text>
      <Text color="text.secondary" fontSize="sm" mb={action ? '20px' : '0'}>
        {description}
      </Text>
      {action}
    </Card>
  )
}
