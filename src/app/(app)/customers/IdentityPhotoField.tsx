'use client'

import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { usePhotoUpload } from 'hooks/usePhotoUpload'
import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type Customer = components['schemas']['Customer']
type IdType = components['schemas']['IdType']

/**
 * Foto identitas.  (S1-021, BR-085)
 *
 * Opening it is never silent: every view writes an audit row on the server and
 * the button says so. The link lives five minutes, so it opens in a new tab
 * rather than being kept anywhere.
 */
export function IdentityPhotoField({ customer, idType }: { customer: Customer; idType: string }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const upload = usePhotoUpload('identity_photo')
  const [has, setHas] = useState(customer.has_id_photo)
  const [error, setError] = useState('')

  const simpan = useMutation({
    retry: false,
    mutationFn: async (key: string) => {
      const { error } = await api.POST('/customers/{id}/identity', {
        params: { path: { id: customer.id } },
        body: { object_key: key, id_type: idType as IdType },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setHas(true)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: () => setError('Foto gagal disimpan. Coba unggah lagi.'),
  })

  // Commit as soon as the PUT finishes; the photo is the whole action here.
  const done = upload.photos.find((p) => p.status === 'done')
  useEffect(() => {
    if (done?.key && !simpan.isPending && !simpan.isSuccess) simpan.mutate(done.key)
  }, [done?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  async function lihat() {
    const tab = window.open('', '_blank') // opened inside the click, so it is not blocked
    const { data, error } = await api.GET('/customers/{id}/identity', { params: { path: { id: customer.id } } })
    if (error || !data) {
      tab?.close()
      return setError('Foto tidak bisa dibuka.')
    }
    if (tab) tab.location.href = data.url
  }

  const uploading = upload.pending || simpan.isPending
  return (
    <Box mt="8px">
      <Text fontSize="sm" fontWeight="500" color="text.primary" mb="6px">Foto identitas</Text>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden
        onChange={(e) => {
          setError('')
          if (e.target.files) upload.add(e.target.files)
          e.target.value = ''
        }} />
      <Flex gap="10px" wrap="wrap" align="center">
        {has && <Button size="sm" variant="outline" onClick={() => void lihat()}>Lihat (tercatat di log)</Button>}
        <Button size="sm" variant="outline" isLoading={uploading} isDisabled={idType === ''}
          onClick={() => input.current?.click()}>
          {has ? 'Ganti foto' : 'Unggah foto'}
        </Button>
        {idType === '' && <Text fontSize="xs" color="text.secondary">Pilih jenis identitas dulu.</Text>}
      </Flex>
      {error !== '' && <Text fontSize="xs" color="red.500" mt="4px">{error}</Text>}
    </Box>
  )
}
