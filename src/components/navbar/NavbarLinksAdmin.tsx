'use client'

import {
  Avatar,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { IoMdMoon, IoMdSunny } from 'react-icons/io'

import { SidebarResponsive } from 'components/sidebar/Sidebar'
import { useCan, useSession } from 'contexts/SessionContext'
import { LOGIN_PATH } from 'lib/api/client'
import routes from 'routes'

/**
 * The navbar's right-hand cluster.
 *
 * Horizon shipped this with a search box that searched nothing, a fake
 * "1,924 ETH" balance, a notification menu listing its own products, and an
 * avatar hardcoded to "Hey, Adela". All of it is gone; what stays is the
 * colour-mode toggle, the mobile drawer, and a real account menu.
 */
export default function HeaderLinks({ secondary }: { secondary: boolean }) {
  const { colorMode, toggleColorMode } = useColorMode()
  const { user, signOut } = useSession()
  const canSettings = useCan('settings:write')
  const canTeam = useCan('users:read')
  const router = useRouter()

  const navbarIcon = useColorModeValue('gray.400', 'white')
  const menuBg = useColorModeValue('white', 'navy.800')
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const borderColor = useColorModeValue('#E6ECFA', 'rgba(135, 140, 189, 0.3)')
  const shadow = useColorModeValue(
    '14px 17px 40px 4px rgba(112, 144, 176, 0.18)',
    '14px 17px 40px 4px rgba(112, 144, 176, 0.06)',
  )

  async function onSignOut() {
    await signOut()
    router.replace(LOGIN_PATH)
  }

  return (
    <Flex
      w={{ sm: '100%', md: 'auto' }}
      alignItems="center"
      flexDirection="row"
      bg={menuBg}
      flexWrap={secondary ? { base: 'wrap', md: 'nowrap' } : 'unset'}
      p="10px"
      borderRadius="30px"
      boxShadow={shadow}
      gap="6px"
    >
      <SidebarResponsive routes={routes} />

      <Text
        display={{ base: 'none', md: 'block' }}
        cursor="pointer"
        color={navbarIcon}
        fontSize="20px"
        onClick={toggleColorMode}
        aria-label={colorMode === 'light' ? 'Mode gelap' : 'Mode terang'}
        as="span"
      >
        {colorMode === 'light' ? <IoMdMoon /> : <IoMdSunny />}
      </Text>

      <Menu>
        <MenuButton p="0px">
          {/* The name comes from /me, so an avatar with no session shows
              nothing rather than somebody else's initials. */}
          <Avatar
            _hover={{ cursor: 'pointer' }}
            color="white"
            name={user?.name ?? ''}
            bg="#11047A"
            size="sm"
            // 44px: sasaran sentuh minimum, sama dengan tombol lain (HIG/WCAG).
            w="44px"
            h="44px"
          />
        </MenuButton>
        <MenuList boxShadow={shadow} p="0px" mt="10px" borderRadius="20px" bg={menuBg} border="none">
          <Flex w="100%" mb="0px">
            <Text
              ps="20px"
              pt="16px"
              pb="10px"
              w="100%"
              borderBottom="1px solid"
              borderColor={borderColor}
              fontSize="sm"
              fontWeight="700"
              color={textColor}
            >
              {user?.name ?? ''}
            </Text>
          </Flex>
          <Flex flexDirection="column" p="10px">
            {/* Owner only, and absent rather than refused for an operator (BR-003). */}
            {canSettings && (
              <MenuItem as={NextLink} href="/settings" _hover={{ bg: 'none' }} _focus={{ bg: 'none' }} borderRadius="8px" px="14px">
                <Text fontSize="sm">Pengaturan</Text>
              </MenuItem>
            )}
            {canSettings && (
              <MenuItem as={NextLink} href="/settings/api-keys" _hover={{ bg: 'none' }} _focus={{ bg: 'none' }} borderRadius="8px" px="14px">
                <Text fontSize="sm">Kunci API</Text>
              </MenuItem>
            )}
            {canTeam && (
              <MenuItem as={NextLink} href="/team" _hover={{ bg: 'none' }} _focus={{ bg: 'none' }} borderRadius="8px" px="14px">
                <Text fontSize="sm">Tim</Text>
              </MenuItem>
            )}
            <MenuItem
              _hover={{ bg: 'none' }}
              _focus={{ bg: 'none' }}
              color="red.400"
              borderRadius="8px"
              px="14px"
              onClick={onSignOut}
            >
              <Text fontSize="sm">Keluar</Text>
            </MenuItem>
          </Flex>
        </MenuList>
      </Menu>
    </Flex>
  )
}
