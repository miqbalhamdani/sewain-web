'use client'

import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useSession } from 'contexts/SessionContext'
import DefaultAuthLayout from 'layouts/auth/Default'
import { api, fieldErrors, problemCode } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type BusinessType = components['schemas']['BusinessType']

/**
 * The two phase-1 presets, in the juragan's own words.  (S1-083, BR-017)
 *
 * Not the enum names. `vehicle_rental` is a database value; "rental mobil &
 * motor" is what the person renting out motorbikes calls their business.
 *
 * Only two, though the schema knows six: boarding_house and apartment are
 * phase 2, venue phase 3, clinic phase 4. Offering a vertical that is not
 * built yet is a promise the product cannot keep.
 */
const PRESETS: { value: BusinessType; label: string; hint: string }[] = [
  {
    value: 'vehicle_rental',
    label: 'Rental mobil & motor',
    hint: 'Kendaraan disewakan harian',
  },
  {
    value: 'equipment_rental',
    label: 'Rental alat',
    hint: 'Kamera, sound system, tenda, alat proyek',
  },
]

/**
 * Register a business.  (S1-083, BR-005)
 *
 * Four fields, and no more. `slug` is not asked for here — it is optional,
 * paid, and set later from Settings. Every field on this screen is a place
 * somebody stops filling it in.
 */
export default function Register() {
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorSecondary = 'gray.400'
  const brandStars = useColorModeValue('brand.500', 'brand.400')

  const router = useRouter()
  const { signIn } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('vehicle_rental')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setFormError('')

    const { data, error: problem } = await api.POST('/auth/register', {
      body: { email, password, business_name: businessName, business_type: businessType },
    })

    setBusy(false)
    if (!data) {
      const code = problemCode(problem)
      if (code === 'email-taken') {
        // Field-level, not a toast: the message belongs next to the input the
        // person has to change.
        setErrors({ email: 'Email ini sudah dipakai. Coba masuk, atau pakai alamat lain.' })
        return
      }
      if (code === 'rate-limited') {
        setFormError('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.')
        return
      }
      const fields = fieldErrors(problem)
      if (Object.keys(fields).length > 0) {
        setErrors(fields)
        return
      }
      setFormError('Pendaftaran gagal. Periksa isian kamu lalu coba lagi.')
      return
    }

    // The session is live immediately — no second login (BR-005). But the
    // address is unproved, so the landing is the verification wall rather than
    // the dashboard (BR-006, 04-api-spec.md §3.1).
    signIn(data)
    router.replace('/verify-email')
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
        mt={{ base: '40px', md: '10vh' }}
        flexDirection="column"
      >
        <Box me="auto">
          <Heading color={textColor} fontSize="36px" mb="10px">
            Daftar usaha
          </Heading>
          <Text mb="28px" ms="4px" color={textColorSecondary} fontWeight="400" fontSize="md">
            Gratis, dan bisa langsung dipakai.
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
            <FormControl isInvalid={errors.business_name !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor} display="flex">
                Nama usaha<Text color={brandStars}>*</Text>
              </FormLabel>
              <Input
                isRequired
                variant="auth"
                fontSize="sm"
                placeholder="Rental Budi"
                size="lg"
                fontWeight="500"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <FormErrorMessage>{errors.business_name}</FormErrorMessage>
            </FormControl>

            <FormControl mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
                Jenis usaha
              </FormLabel>
              {/* No price-unit picker anywhere on this form. Both phase-1
                  presets are priced per day, and the server fills pricing_unit
                  from this choice — asking would be asking a question that
                  only exists for a vertical nobody has opened (BR-017). */}
              <RadioGroup value={businessType} onChange={(v) => setBusinessType(v as BusinessType)}>
                <Stack spacing="10px">
                  {PRESETS.map((preset) => (
                    <Radio key={preset.value} value={preset.value} colorScheme="brand">
                      <Text fontSize="sm" fontWeight="500" color={textColor}>
                        {preset.label}
                      </Text>
                      <Text fontSize="xs" color={textColorSecondary}>
                        {preset.hint}
                      </Text>
                    </Radio>
                  ))}
                </Stack>
              </RadioGroup>
            </FormControl>

            <FormControl isInvalid={errors.email !== undefined} mb="20px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor} display="flex">
                Email<Text color={brandStars}>*</Text>
              </FormLabel>
              <Input
                isRequired
                variant="auth"
                fontSize="sm"
                type="email"
                placeholder="budi@contoh.id"
                size="lg"
                fontWeight="500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FormErrorMessage>{errors.email}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={errors.password !== undefined} mb="8px">
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" color={textColor} display="flex">
                Password<Text color={brandStars}>*</Text>
              </FormLabel>
              <Input
                isRequired
                variant="auth"
                fontSize="sm"
                type="password"
                placeholder="Minimal 8 karakter"
                size="lg"
                fontWeight="500"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FormErrorMessage>{errors.password}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={formError !== ''}>
              {formError !== '' && <FormErrorMessage mb="12px">{formError}</FormErrorMessage>}
            </FormControl>

            <Button
              type="submit"
              fontSize="sm"
              variant="brand"
              fontWeight="500"
              w="100%"
              h="50"
              mt="16px"
              mb="24px"
              isLoading={busy}
            >
              Daftar
            </Button>
          </form>

          <Flex flexDirection="column" justifyContent="center" alignItems="start" maxW="100%">
            <Text color={textColorSecondary} fontWeight="400" fontSize="14px">
              Sudah punya akun?
              <NextLink href="/login">
                <Text as="span" ms="5px" color={brandStars} fontWeight="500">
                  Masuk
                </Text>
              </NextLink>
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </DefaultAuthLayout>
  )
}
