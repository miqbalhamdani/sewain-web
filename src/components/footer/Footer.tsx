'use client'

import { Flex, Link, Text, useColorModeValue } from '@chakra-ui/react'

/**
 * The footer, for both the auth screens and the backoffice.
 *
 * There were two of these, `FooterAdmin` and `FooterAuth`, because Horizon
 * shipped two: one was a row of Simmmple links (licences, blog, an email
 * address) and the other its short form. Once both were gutted, what remained
 * were two copies of the same six lines that had drifted apart on colour,
 * breakpoint, and a `px` value of `'ateral'` — not a CSS value at all, silently
 * dropped by the browser, which is exactly why nobody noticed.
 *
 * Positioning is the parent's job. A footer that sets its own margins cannot be
 * placed anywhere it was not already placed.
 */
export default function Footer() {
  const textColor = useColorModeValue('gray.400', 'white')

  return (
    <Flex
      zIndex="3"
      direction={{ base: 'column', md: 'row' }}
      alignItems="center"
      justifyContent="space-between"
      gap="12px"
      pb="30px"
    >
      <Text color={textColor}>&copy; {new Date().getFullYear()} Sewain</Text>
      <Link fontWeight="500" color={textColor} href="mailto:halo@sewain.id">
        Butuh bantuan?
      </Link>
    </Flex>
  )
}
