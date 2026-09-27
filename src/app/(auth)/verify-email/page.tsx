'use client'

import { Alert, AlertIcon, Box, Button, Flex, Heading, Spinner, Text, useColorModeValue } from '@chakra-ui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'

import { useSession } from 'contexts/SessionContext'
import { api, problemCode } from 'lib/api/client'

/**
 * The verification wall, and the page the emailed link lands on.  (S1-084, BR-006)
 *
 * One screen for both because they are two states of one thing: with a token
 * in the URL it redeems it, without one it explains and offers a resend. An
 * unverified account can do exactly one thing, so there is exactly one screen
 * where it can do it.
 */
function VerifyEmail() {
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorSecondary = 'gray.400'

  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')
  const { user, refresh } = useSession()

  const [state, setState] = useState<'idle' | 'verifying' | 'failed' | 'sent'>(
    token ? 'verifying' : 'idle',
  )
  const [message, setMessage] = useState('')

  const redeem = useCallback(
    async (value: string) => {
      const { error: problem, response } = await api.POST('/auth/verify-email', {
        body: { token: value },
      })

      if (response.status !== 204) {
        setState('failed')
        setMessage(
          problemCode(problem) === 'verification-token-invalid'
            ? 'Tautannya sudah kedaluwarsa atau pernah dipakai. Minta yang baru di bawah.'
            : 'Verifikasi gagal. Coba minta tautan baru.',
        )
        return
      }

      // The verified flag rides in the access token, so the one in memory
      // still says unverified. Refresh trades it for a new one — that is the
      // documented cost of not asking the database on every request.
      //
      // Through the context, never api.POST('/auth/refresh') directly: the
      // provider may be booting its own refresh at this exact moment, and two
      // rotations of one cookie are read as theft and revoke every session
      // the user has (S1-008).
      await refresh()
      router.replace('/dashboard')
    },
    [refresh, router],
  )

  useEffect(() => {
    if (token) void redeem(token)
  }, [token, redeem])

  async function resend() {
    setMessage('')
    const { response } = await api.POST('/auth/verify-email/resend')
    if (response.status === 429) {
      setState('failed')
      setMessage('Sudah terlalu sering. Coba lagi dalam satu jam.')
      return
    }
    setState('sent')
    setMessage('Tautan baru sudah dikirim. Cek kotak masuk kamu.')
  }

  return (
    <Flex
      maxW={{ base: '100%', md: 'max-content' }}
      w="100%"
      mx={{ base: 'auto', lg: '0px' }}
      me="auto"
      h="100%"
      alignItems="start"
      justifyContent="center"
      px={{ base: '25px', md: '0px' }}
      mt={{ base: '40px', md: '14vh' }}
      flexDirection="column"
    >
      <Box me="auto" maxW="420px">
        <Heading color={textColor} fontSize="36px" mb="10px">
          Verifikasi email
        </Heading>

        {state === 'verifying' ? (
          <Flex align="center" gap="12px" mt="24px">
            <Spinner color="brand.500" />
            <Text color={textColorSecondary}>Memverifikasi…</Text>
          </Flex>
        ) : (
          <>
            <Text mb="24px" ms="4px" color={textColorSecondary} fontWeight="400" fontSize="md">
              Kami mengirim tautan ke <b>{user?.name ?? 'email kamu'}</b>. Klik tautan itu untuk
              mulai memakai Sewain.
            </Text>

            {/* Why this gate exists, in the owner's terms rather than ours.
                BR-006: email is the only owner identity with proof behind
                it, so an unverified account has no recovery path at all. */}
            <Text mb="24px" ms="4px" color={textColorSecondary} fontSize="sm">
              Email kamu satu-satunya cara memulihkan akun kalau lupa password. Karena itu ia
              diverifikasi dulu, sebelum ada data yang bisa hilang.
            </Text>

            {message !== '' && (
              <Alert status={state === 'sent' ? 'success' : 'warning'} borderRadius="12px" mb="20px">
                <AlertIcon />
                {message}
              </Alert>
            )}

            {/* Always available: expiry must not be a dead end, because
                verifying is the only thing this account can do (BR-006). */}
            <Button variant="brand" fontSize="sm" fontWeight="500" w="100%" h="50" onClick={resend}>
              Kirim ulang tautan
            </Button>
          </>
        )}
      </Box>
    </Flex>
  )
}

export default function Page() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
  <Suspense fallback={null}>
    <VerifyEmail />
  </Suspense>
  )
}
