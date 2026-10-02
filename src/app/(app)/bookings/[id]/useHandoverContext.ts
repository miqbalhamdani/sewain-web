'use client'

import { useQuery } from '@tanstack/react-query'

import { CHECKLISTS } from 'components/handover/checklist'
import { api } from 'lib/api/client'

/**
 * The booking and what kind of thing it is -- a vehicle needs the odometer
 * (S1-035: "metered" = has vehicle specs) and gets its checklist template.
 */
export function useHandoverContext(id: string) {
  const booking = useQuery({
    queryKey: ['bookings', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/bookings/{id}', { params: { path: { id } } })
      if (error) throw error
      return data
    },
  })
  const resourceId = booking.data?.resource.id
  const resource = useQuery({
    queryKey: ['resources', resourceId],
    enabled: resourceId !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET('/resources/{id}', { params: { path: { id: resourceId! } } })
      if (error) throw error
      return data
    },
  })
  const vehicleType = resource.data?.vehicle?.vehicle_type
  return {
    booking: booking.data,
    isPending: booking.isPending || resource.isPending,
    isVehicle: vehicleType !== undefined,
    items: vehicleType ? (CHECKLISTS[vehicleType] ?? []) : [],
  }
}
