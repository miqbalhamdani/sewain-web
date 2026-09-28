import { Icon } from '@chakra-ui/react'
import {
  MdBarChart,
  MdHome,
  MdInventory2,
  MdOutlineShoppingCart,
  MdPerson,
} from 'react-icons/md'

import { IRoute } from 'types/navigation'

/**
 * Backoffice navigation.
 *
 * Paths are absolute: `(app)` is a route group, so it contributes nothing to
 * the URL. There is no `layout` field any more — the old one existed to
 * concatenate `/admin` in front of everything, and route groups do that job
 * without putting the word in the address bar.
 */
const routes: IRoute[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: <Icon as={MdHome} width="20px" height="20px" color="inherit" />,
  },
  {
    // Both roles: an operator reads the catalogue for every job they do, and
    // only the write actions inside are hidden from them (BR-003).
    name: 'Barang',
    path: '/catalog',
    icon: <Icon as={MdInventory2} width="20px" height="20px" color="inherit" />,
    permission: 'resources:read',
  },
  {
    name: 'Booking',
    path: '/bookings',
    icon: <Icon as={MdOutlineShoppingCart} width="20px" height="20px" color="inherit" />,
    permission: 'bookings:read',
  },
  {
    name: 'Penyewa',
    path: '/customers',
    icon: <Icon as={MdPerson} width="20px" height="20px" color="inherit" />,
    permission: 'customers:read',
  },
  {
    // The one entry BR-003 names explicitly: an operator does not see it at
    // all, rather than seeing it and being refused.
    name: 'Laporan',
    path: '/reports',
    icon: <Icon as={MdBarChart} width="20px" height="20px" color="inherit" />,
    permission: 'reports:read',
  },
]

export default routes
