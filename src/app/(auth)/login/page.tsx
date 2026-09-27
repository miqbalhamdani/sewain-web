'use client'

import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RiEyeCloseLine } from 'react-icons/ri'
import { MdOutlineRemoveRedEye } from 'react-icons/md'

import { useSession } from 'contexts/SessionContext'
import DefaultAuthLayout from 'layouts/auth/Default'
import { api, problemCode } from 'lib/api/client'

/**
 * Sign in.  (S1-013)
 *
 * Email and password, and nothing else. Horizon shipped this screen with a
 * Google button, a "keep me logged in" checkbox and a forgot-password link:
 * there is no OAuth in the contract, session lifetime is the refresh cookie's
 * business rather than a client toggle, and the reset flow has no endpoint.
 * A control that cannot work is worse than a missing one — it advertises
 * something and then fails.
 */
export default function Login() {
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorSecondary = 'gray.400'
  const brandStars = useColorModeValue('brand.500', 'brand.400')

  const router = useRouter()
  const { signIn } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { data, error: problem } = await api.POST('/auth/login', {
      body: { email, password },
    })

    setBusy(false)
    if (!data) {
      // Login answers one 401 for a wrong password and for an unknown address
      // alike, so there is one message here too. Distinguishing them would
      // answer "does this person have an account" for free.
      setError(
        problemCode(problem) === 'rate-limited'
          ? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
          : 'Email atau password salah.',
      )
      return
    }

    signIn(data)
    // The wall, not the dashboard, when the address is still unproved (BR-006).
    router.replace(data.user.email_verified_at ? '/dashboard' : '/verify-email')
  }

  return (
    <DefaultAuthLayout illustrationBackground="/img/auth/auth.png">
      <Flex
        maxW={{ base: '100%', md: 'max-content' }}
        w="100%"
        mx={{ base: 'auto', lg: '0px' }}
        me="auto"
        h="100%"
        alignItems="start"
        justifyContent="center"
        mb={{ base: '30px', md: '60px' }}
        px={{ base: '25px', md: '0px' }}
        mt={{ base: '40px', md: '14vh' }}
        flexDirection="column"
      >
        <Box me="auto">
          <Heading color={textColor} fontSize="36px" mb="10px">
            Masuk
          </Heading>
          <Text mb="36px" ms="4px" color={textColorSecondary} fontWeight="400" fontSize="md">
            Masukkan email dan password usaha kamu.
          </Text>
        </Box>

        <Flex
          zIndex="2"
          direction="column"
          w={{ base: '100%', md: '420px' }}
          maxW="100%"
          background="transparent"
          borderRadius="15px"
          mx={{ base: 'auto', lg: 'unset' }}
          me="auto"
          mb={{ base: '20px', md: 'auto' }}
        >
          <form onSubmit={onSubmit}>
            <FormControl isInvalid={error !== ''}>
              <FormLabel display="flex" ms="4px" fontSize="sm" fontWeight="500" color={textColor} mb="8px">
                Email<Text color={brandStars}>*</Text>
              </FormLabel>
              <Input
                isRequired
                variant="auth"
                fontSize="sm"
                type="email"
                name="email"
                placeholder="budi@contoh.id"
                mb="24px"
                fontWeight="500"
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor} display="flex">
                Password<Text color={brandStars}>*</Text>
              </FormLabel>
              <InputGroup size="md">
                <Input
                  isRequired
                  fontSize="sm"
                  placeholder="Minimal 8 karakter"
                  mb="24px"
                  size="lg"
                  type={show ? 'text' : 'password'}
                  name="password"
                  variant="auth"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <InputRightElement display="flex" alignItems="center" mt="4px">
                  <Icon
                    color={textColorSecondary}
                    _hover={{ cursor: 'pointer' }}
                    as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                  />
                </InputRightElement>
              </InputGroup>

              {error !== '' && <FormErrorMessage mb="16px">{error}</FormErrorMessage>}

              <Button
                type="submit"
                fontSize="sm"
                variant="brand"
                fontWeight="500"
                w="100%"
                h="50"
                mt="8px"
                mb="24px"
                isLoading={busy}
              >
                Masuk
              </Button>
            </FormControl>
          </form>

          <Flex flexDirection="column" justifyContent="center" alignItems="start" maxW="100%" mt="0px">
            <Text color={textColorSecondary} fontWeight="400" fontSize="14px">
              Belum punya akun?
              <NextLink href="/register">
                <Text as="span" ms="5px" color={brandStars} fontWeight="500">
                  Daftar usaha
                </Text>
              </NextLink>
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </DefaultAuthLayout>
  )
}
