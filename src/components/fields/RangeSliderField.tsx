'use client'

import {
  Flex,
  FormControl,
  FormLabel,
  RangeSlider,
  RangeSliderFilledTrack,
  RangeSliderThumb,
  RangeSliderTrack,
  Text,
} from '@chakra-ui/react'
import { useId } from 'react'

type RangeSliderFieldProps = {
  label: string
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (value: [number, number]) => void

  /**
   * Angka jadi teks yang dibaca juragan. Dibiarkan kosong untuk satuan yang
   * angkanya sudah terbaca apa adanya, seperti tahun.
   */
  format?: (value: number) => string
  helper?: string
}

/**
 * Rentang angka dengan dua pegangan.
 *
 * Satu komponen untuk harga dan tahun: keduanya rentang, dan yang berbeda cuma
 * satuannya -- itu yang dikerjakan `format`.
 *
 * Pemanggil yang menentukan "aktif": rentang yang masih menyentuh kedua ujung
 * tidak menyaring apa pun, dan tidak boleh ikut dihitung sebagai saring aktif.
 */
export function RangeSliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format = String,
  helper,
}: RangeSliderFieldProps) {
  const labelId = useId()

  return (
    <FormControl mb="20px">
      {/* Jaraknya di baris label, BUKAN sebagai padding slider: Chakra Slider
          menyetel padding-nya sendiri dari ukuran pegangan, jadi `pt` di
          komponennya tidak menggeser apa pun (terukur: tetap 2px). */}
      <Flex align="baseline" justify="space-between" gap="12px" mb="16px">
        <FormLabel id={labelId} mb="0" ms="4px" fontSize="sm" fontWeight="500" color="text.primary">
          {label}
        </FormLabel>
        {/* Nilainya dibaca, bukan ditebak dari posisi pegangan. */}
        <Text fontSize="xs" fontWeight="600" color="text.primary" whiteSpace="nowrap">
          {format(value[0])} – {format(value[1])}
        </Text>
      </Flex>

      {/* `aria-label` sebagai ARRAY, satu per pegangan, dan itu memang
          konvensi RangeSlider Chakra -- tipenya `string[]`, dan
          `useRangeSliderThumb` membuang `aria-label` yang dipasang di
          <RangeSliderThumb> (terukur: thumb-nya lahir tanpa nama sama sekali).
          Aturan lint di bawah mengira ini atribut DOM biasa; ia tidak tahu
          Chakra memecahnya per indeks. */}
      <RangeSlider
        // eslint-disable-next-line jsx-a11y/aria-proptypes
        aria-label={[`${label}, batas bawah`, `${label}, batas atas`]}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(next) => onChange([next[0], next[1]])}
        // Ruang untuk pegangan di kedua ujung, supaya ia tidak terpotong tepi
        // kolom grid-nya.
        // Ruang untuk pegangan di kedua ujung, supaya ia tidak terpotong tepi
        // kolom grid-nya.
        px="10px"
      >
        <RangeSliderTrack h="6px">
          <RangeSliderFilledTrack />
        </RangeSliderTrack>
        <RangeSliderThumb index={0} boxSize="18px" />
        <RangeSliderThumb index={1} boxSize="18px" />
      </RangeSlider>

      {helper !== undefined && (
        <Text fontSize="xs" color="text.secondary" ms="4px">
          {helper}
        </Text>
      )}
    </FormControl>
  )
}
