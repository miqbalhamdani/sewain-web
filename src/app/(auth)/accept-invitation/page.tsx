'use client'

import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormErrorMessage, FormLabel, Heading, Text, useColorModeValue } from '@chakra-ui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { PasswordField } from 'components/fields/PasswordField'
import { useSession } from 'contexts/SessionContext'
import { api } from 'lib/api/client'

/**
 * Where the invitation email lands.  (S1-067, BR-004)
 *
 * The invitee sets a password and is signed in. Accepting also proves the
 * address, since the link only reached them through it (BR-006).
 */
function AcceptInvitation() {
  const textColor = useColorModeValue('navy.700', 'white')
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''
  const { signIn } = useSession()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, response } = await api.POST('/auth/accept-invitation', { body: { token, password } })
    setBusy(false)
    if (!data) {
      setError(response.status === 422
        ? 'Password minimal 8 karakter.'
        : 'Tautan undangan tidak berlaku lagi. Minta pemilik usaha mengirim ulang undangannya.')
      return
    }
    signIn(data)
    router.replace('/dashboard')
  }

  return (
    <Flex maxW={{ base: '100%', md: 'max-content' }} w="100%" mx={{ base: 'auto', lg: '0px' }} me="auto" h="100%"
      alignItems="start" justifyContent="center" mb={{ base: '30px', md: '60px' }} px={{ base: '25px', md: '0px' }}
      mt={{ base: '40px', md: '14vh' }} flexDirection="column">
      <Box me="auto">
        <Heading color={textColor} fontSize="36px" mb="10px">Terima undangan</Heading>
        <Text mb="36px" ms="4px" color="gray.400" fontSize="md">Buat password untuk masuk ke backoffice usaha yang mengundangmu.</Text>
      </Box>
      <Box w={{ base: '100%', md: '420px' }} maxW="100%">
        {token === '' ? (
          <Alert status="warning" borderRadius="12px"><AlertIcon />Tautan ini tidak lengkap. Buka lagi tautan dari email undangan.</Alert>
        ) : (
          <form onSubmit={onSubmit}>
            <FormControl isInvalid={error !== ''}>
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>Password baru</FormLabel>
              <PasswordField isRequired minLength={8} mb="24px" placeholder="Minimal 8 karakter" autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              {error !== '' && <FormErrorMessage mb="16px">{error}</FormErrorMessage>}
              <Button type="submit" variant="brand" w="100%" h="50" isLoading={busy}>Masuk</Button>
            </FormControl>
          </form>
        )}
      </Box>
    </Flex>
  )
}

// useSearchParams needs a Suspense boundary for the static build.
export default function Page() {
  return <Suspense><AcceptInvitation /></Suspense>
}
