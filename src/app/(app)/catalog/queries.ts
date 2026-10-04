import { api } from 'lib/api/client'

/**
 * Satu definisi per query yang dipakai lebih dari satu layar.
 *
 * Kunci dan bentuk data harus identik di mana pun ia dibaca: daftar barang
 * mem-prefetch-nya saat menu baris dibuka, layar unit membacanya, saring
 * booking membangun pilihan plat darinya. Tiga salinan queryFn adalah tiga
 * kesempatan menaruh bentuk berbeda di bawah kunci yang sama.
 */
export const resourceQuery = (id: string) => ({
  queryKey: ['resources', id],
  queryFn: async () => {
    const { data, error } = await api.GET('/resources/{id}', { params: { path: { id } } })
    if (error) throw error
    return data
  },
})

export const resourcesQuery = {
  queryKey: ['resources'],
  queryFn: async () => {
    const { data, error } = await api.GET('/resources')
    if (error) throw error
    return data
  },
}

export const unitsQuery = (id: string) => ({
  queryKey: ['resources', id, 'units'],
  queryFn: async () => {
    const { data, error } = await api.GET('/resources/{id}/units', { params: { path: { id } } })
    if (error) throw error
    return data
  },
})
