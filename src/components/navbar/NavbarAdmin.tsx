/* eslint-disable */
// Chakra Imports
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Heading,
  Text,
  useColorModeValue
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { useState, useEffect } from 'react'
import AdminNavbarLinks from 'components/navbar/NavbarLinksAdmin'
import { usePageHeader } from 'contexts/PageHeaderContext'

export default function AdminNavbar (props: {
  secondary: boolean
  fixed: boolean
  onOpen: (...args: any[]) => any
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // You now have access to `window`
      window.addEventListener('scroll', changeNavbar)

      return () => {
        window.removeEventListener('scroll', changeNavbar)
      }
    }
  })

  const { secondary } = props

  // Judulnya datang dari halaman yang sedang dirender, bukan dari prop: navbar
  // ini di dalam <Portal> dan layout tidak tahu halaman apa yang ada di
  // dalamnya. Sebelumnya di sini nama usaha, yang sama di setiap halaman dan
  // karena itu tidak memberi tahu apa pun tentang di mana juragan berada.
  const header = usePageHeader()

  // Here are all the props that may change depending on navbar's type or state.(secondary, variant, scrolled)
  let mainText = useColorModeValue('navy.700', 'white')
  let secondaryText = useColorModeValue('gray.700', 'white')
  let navbarPosition = 'fixed' as const
  let navbarFilter = 'none'
  let navbarBackdrop = 'blur(20px)'
  let navbarShadow = 'none'
  let navbarBg = useColorModeValue(
    'rgba(244, 247, 254, 0.2)',
    'rgba(11,20,55,0.5)'
  )
  let navbarBorder = 'transparent'
  let secondaryMargin = '0px'
  let paddingX = '15px'
  let gap = '0px'
  const changeNavbar = () => {
    if (typeof window !== 'undefined' && window.scrollY > 1) {
      setScrolled(true)
    } else {
      setScrolled(false)
    }
  }

  return (
    <Box
      position={navbarPosition}
      boxShadow={navbarShadow}
      bg={navbarBg}
      borderColor={navbarBorder}
      filter={navbarFilter}
      backdropFilter={navbarBackdrop}
      backgroundPosition='center'
      backgroundSize='cover'
      borderRadius='16px'
      borderWidth='1.5px'
      borderStyle='solid'
      transitionDelay='0s, 0s, 0s, 0s'
      transitionDuration=' 0.25s, 0.25s, 0.25s, 0s'
      transition-property='box-shadow, background-color, filter, border'
      transitionTimingFunction='linear, linear, linear, linear'
      alignItems={{ xl: 'center' }}
      display={secondary ? 'block' : 'flex'}
      minH='75px'
      justifyContent={{ xl: 'center' }}
      lineHeight='25.6px'
      mx='auto'
      mt={secondaryMargin}
      pb='8px'
      right={{ base: '12px', md: '30px', lg: '30px', xl: '30px' }}
      px={{
        sm: paddingX,
        md: '10px'
      }}
      ps={{
        xl: '12px'
      }}
      pt='8px'
      top={{ base: '12px', md: '16px', xl: '18px' }}
      w={{
        base: 'calc(100vw - 6%)',
        md: 'calc(100vw - 8%)',
        lg: 'calc(100vw - 6%)',
        xl: 'calc(100vw - 350px)',
        '2xl': 'calc(100vw - 365px)'
      }}
    >
      <Flex
        w='100%'
        flexDirection={{
          sm: 'column',
          md: 'row'
        }}
        alignItems={{ xl: 'center' }}
        mb={gap}
      >
        <Box mb={{ sm: '8px', md: '0px' }} minW='0'>
          {/* text.secondary, bukan `secondaryText` milik template: yang terakhir
              itu useColorModeValue('gray.700','white'), jadi di mode gelap jejak
              dan judul sama-sama putih dan jejaknya berhenti terbaca sebagai
              yang lebih kecil. */}
          <Breadcrumb fontSize='sm' color='text.secondary' mb='4px' separator='/'>
            {header?.breadcrumb.map((crumb, i) => (
              // Kunci dari posisi, bukan label: jejak adalah daftar berurut yang
              // tidak pernah disusun ulang, dan dua segmen bisa berlabel sama
              // selama salah satunya masih memuat.
              <BreadcrumbItem key={i} isCurrentPage={crumb.href === undefined}>
                {crumb.href === undefined ? (
                  <Text>{crumb.label}</Text>
                ) : (
                  <BreadcrumbLink as={NextLink} href={crumb.href}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
          {/* Satu-satunya h1 aplikasi ini. Dulu <Link href='#'> yang tidak
              menuju ke mana-mana, dan isinya nama usaha. */}
          <Heading as='h1' color={mainText} fontWeight='bold' fontSize='34px' noOfLines={1}>
            {header?.title ?? ''}
          </Heading>
        </Box>
        <Box ms='auto' w={{ sm: '100%', md: 'unset' }}>
          <AdminNavbarLinks secondary={props.secondary} />
        </Box>
      </Flex> 
    </Box>
  )
}
