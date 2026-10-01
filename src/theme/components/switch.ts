import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";
export const switchStyles = {
  components: {
    Switch: {
      baseStyle: {
        thumb: {
          fontWeight: 400,
          borderRadius: "50%",
          w: "16px",
          h: "16px",
          _checked: { transform: "translate(20px, 0px)" },
        },
        track: {
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
          w: "40px",
          h: "20px",
          p: "2px",
          ps: "2px",
          // Chakra memberi track cincin fokus; template Horizon mencabutnya.
          // Itu bukan pilihan gaya melainkan regresi aksesibilitas: sakelar
          // "Wajib verifikasi identitas" di form resource tidak bisa dilihat
          // pemakainya saat di-Tab. _focusVisible, bukan _focus, supaya
          // cincinnya cuma muncul untuk keyboard -- klik mouse tidak
          // meninggalkan cincin yang menggantung.
          _focusVisible: {
            boxShadow: "outline",
          },
        },
      },

      variants: {
        main: (props: StyleFunctionProps) => ({
          track: {
            bg: mode("gray.300", "navy.700")(props),
          },
        }),
      },
    },
  },
};
