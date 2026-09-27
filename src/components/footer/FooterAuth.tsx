'use client'

import { Flex, Link, Text, useColorModeValue } from '@chakra-ui/react'

/**
 * Horizon's footer was a row of Simmmple links — licences, blog, an email
 * address. None of it belongs on a login screen for somebody else's product.
 */
export default function Footer() {
  const textColor = useColorModeValue('secondaryGray.600', 'white')

  return (
    <Flex
      zIndex="3"
      direction={{ base: 'column', md: 'row' }}
      alignItems="center"
      justifyContent="space-between"
      px={{ base: '30px', md: 'ateral' }}
      pb="30px"
      mx="auto"
    >
      <Text color={textColor} textAlign={{ base: 'center', xl: 'start' }} mb={{ base: '20px', lg: '0px' }}>
        &copy; {new Date().getFullYear()} Sewain
      </Text>
      <Link fontWeight="500" color={textColor} href="mailto:halo@sewain.id">
        Butuh bantuan?
      </Link>
    </Flex>
  )
}
