'use client'

import { Flex, Link, Text, useColorModeValue } from '@chakra-ui/react'

/**
 * Horizon's footer linked to its own licences, blog and support address.
 * None of that is ours to show inside somebody's rental backoffice.
 */
export default function Footer() {
  const textColor = useColorModeValue('gray.400', 'white')

  return (
    <Flex
      zIndex="3"
      flexDirection={{ base: 'column', xl: 'row' }}
      alignItems={{ base: 'center', xl: 'start' }}
      justifyContent="space-between"
      px={{ base: '30px', md: '50px' }}
      pb="30px"
    >
      <Text color={textColor} textAlign={{ base: 'center', xl: 'start' }} mb={{ base: '20px', xl: '0px' }}>
        &copy; {new Date().getFullYear()} Sewain
      </Text>
      <Link fontWeight="500" color={textColor} href="mailto:halo@sewain.id">
        Butuh bantuan?
      </Link>
    </Flex>
  )
}
