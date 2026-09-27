'use client'

import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react'
import { PropsWithChildren } from 'react'

import AppWrappers from 'app/AppWrappers'
import FixedPlugin from 'components/fixedPlugin/FixedPlugin'
import Footer from 'components/footer/Footer'

/**
 * The shell for /login, /register and /verify-email.
 *
 * This used to be two things: a nearly empty `layout.tsx` that only supplied
 * providers, and `layouts/auth/Default.tsx` that every page imported by hand to
 * get the illustration, the wordmark and the footer. That split came from
 * Horizon, which predates the App Router and so had nowhere else to put a
 * shell.
 *
 * The cost was real: a new auth page that forgot the manual wrapper lost its
 * chrome, and nothing failed — no compile error, no lint, no test. Now Next
 * mounts it, the way it already does for `(app)`, and forgetting is not
 * possible.
 */
const ILLUSTRATION = '/img/auth/auth.png'

function AuthShell({ children }: PropsWithChildren) {
  const authBg = useColorModeValue('white', 'navy.900')

  return (
    <Flex minW="100vh" w="100%" bg={authBg} position="relative" h="max-content">
      <Flex
        h={{ sm: 'initial', md: 'unset', lg: '100vh', xl: '100vh' }}
        w={{ base: '100vw', md: '100%' }}
        maxW={{ md: '66%', lg: '1313px' }}
        mx={{ md: 'auto' }}
        pt={{ sm: '50px', md: '0px' }}
        px={{ base: '30px', lg: '30px', xl: '0px' }}
        ps={{ xl: '70px' }}
        justifyContent="start"
        direction="column"
      >
        {/* Horizon's "Back to Simmmple" chevron used to sit here. There is
            nowhere to go back to: this IS the front door. */}
        <Text mt="40px" fontSize="2xl" fontWeight="bold" color="brand.500">
          Sewain
        </Text>

        {children}

        {/* One illustration for all three screens. It used to be a prop each
            page passed, but all three passed the same file — a parameter that
            never varies is a parameter that only hides where the value lives. */}
        <Box
          display={{ base: 'none', md: 'block' }}
          h="100%"
          minH="100vh"
          w={{ lg: '50vw', '2xl': '44vw' }}
          position="absolute"
          right="0px"
        >
          <Flex
            style={{ backgroundImage: `url(${ILLUSTRATION})` }}
            justify="center"
            align="end"
            w="100%"
            h="100%"
            bgSize="cover"
            bgPosition="50%"
            position="absolute"
            borderBottomLeftRadius={{ lg: '120px', xl: '200px' }}
          />
        </Box>

        <Footer />
      </Flex>
      <FixedPlugin />
    </Flex>
  )
}

// ChakraProvider lives here rather than in the root layout, so `(public)/[slug]`
// inherits neither Chakra nor Horizon's global CSS — and no session.
export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <AppWrappers>
      <AuthShell>{children}</AuthShell>
    </AppWrappers>
  )
}
