'use client'

import { Box, Flex, Portal, Spinner, useColorModeValue, useDisclosure } from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { PropsWithChildren, useEffect, useState } from 'react'

import AppWrappers from 'app/AppWrappers'
import Footer from 'components/footer/Footer'
import Navbar from 'components/navbar/NavbarAdmin'
import Sidebar from 'components/sidebar/Sidebar'
import { useSession } from 'contexts/SessionContext'
import { SidebarContext } from 'contexts/SidebarContext'
import { LOGIN_PATH, VERIFY_PATH } from 'lib/api/client'
import routes from 'routes'

interface DashboardLayoutProps extends PropsWithChildren {
  [x: string]: any
}

/**
 * Two guards, in order.  (S1-013, BR-006)
 *
 * Anonymous goes to /login. A signed-in user whose `email_verified_at` is
 * still null goes to /verify-email, and that applies before every product
 * screen rather than some of them — the HTTP client catches the 403 as a
 * backstop, but the point of checking here is that the screen never renders
 * and then vanishes.
 *
 * Both wait for `loading`. Redirecting before the boot refresh settles would
 * bounce a signed-in user to /login on the first paint after every reload.
 */
function Guards({ children }: PropsWithChildren) {
  const { user, loading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(LOGIN_PATH)
      return
    }
    if (!user.email_verified_at) {
      router.replace(VERIFY_PATH)
    }
  }, [loading, user, router])

  if (loading || !user || !user.email_verified_at) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <Spinner size="xl" thickness="4px" color="brand.500" />
      </Flex>
    )
  }
  return <>{children}</>
}

function AppLayoutInner(props: DashboardLayoutProps) {
  const { children, ...rest } = props
  const [fixed] = useState(false)
  const [toggleSidebar, setToggleSidebar] = useState(false)
  const { onOpen } = useDisclosure()
  const { owner } = useSession()

  const bg = useColorModeValue('secondaryGray.300', 'navy.900')

  return (
    <Box h="100vh" w="100vw" bg={bg}>
      <SidebarContext.Provider value={{ toggleSidebar, setToggleSidebar }}>
        <Sidebar routes={routes} display="none" {...rest} />
        <Box
          float="right"
          minHeight="100vh"
          height="100%"
          overflow="auto"
          position="relative"
          maxHeight="100%"
          w={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          maxWidth={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          transition="all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)"
          transitionDuration=".2s, .2s, .35s"
          transitionProperty="top, bottom, width"
          transitionTimingFunction="linear, linear, ease"
        >
          <Portal>
            <Box>
              {/* The business name comes from /me, never from decoding the
                  access token in the browser: that token is for the server,
                  and parsing it here makes two sources of truth (BR-004). */}
              <Navbar onOpen={onOpen} brandText={owner?.name ?? ''} secondary={false} fixed={fixed} {...rest} />
            </Box>
          </Portal>

          <Box mx="auto" p={{ base: '20px', md: '30px' }} pe="20px" minH="100vh" pt="50px">
            {children}
          </Box>
          {/* Spacing belongs to the parent: the footer sets none of its own. */}
          <Box px={{ base: '30px', md: '50px' }}>
            <Footer />
          </Box>
        </Box>
      </SidebarContext.Provider>
    </Box>
  )
}

// ChakraProvider lives here, not in the root layout: (public)/[slug] must not
// inherit Chakra, Horizon's global CSS, or a session.
export default function AppLayout(props: DashboardLayoutProps) {
  return (
    <AppWrappers>
      <Guards>
        <AppLayoutInner {...props} />
      </Guards>
    </AppWrappers>
  )
}
