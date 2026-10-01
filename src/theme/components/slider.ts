import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

export const sliderStyles = {
  components: {
    // Kuncinya `Slider`, BUKAN `RangeSlider`.
    //
    // `RangeSliderProps extends ThemingProps<"Slider">`, dan
    // @chakra-ui/slider memanggil `useMultiStyleConfig("Slider", ...)` untuk
    // kedua komponen. `RangeSlider` tidak ada sebagai kunci tema di Chakra --
    // jadi berkas ini, sejak warisan Horizon, menulis varian `main` ke kunci
    // yang tidak pernah dibaca siapa pun. Dead config yang lolos typecheck,
    // lint, dan build; ketahuan hanya karena sekarang slidernya benar-benar
    // dipakai.
    Slider: {
      baseStyle: (props: StyleFunctionProps) => ({
        thumb: {
          bg: mode("brand.500", "brand.400")(props),
          borderWidth: "0",
          boxShadow: "0 1px 4px rgba(112, 144, 176, 0.4)",
          _focusVisible: { boxShadow: "outline" },
        },
        filledTrack: {
          bg: mode("brand.500", "brand.400")(props),
        },
        track: {
          bg: mode("secondaryGray.300", "whiteAlpha.200")(props),
          borderRadius: "full",
        },
      }),
    },
  },
};
