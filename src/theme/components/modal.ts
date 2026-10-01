import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

export const modalStyles = {
  components: {
    // Satu kunci untuk Modal DAN AlertDialog: keduanya memakai anatomi yang
    // sama di Chakra. Jadi ini sekaligus memperbaiki dialog yang sudah ada sejak
    // lama -- konfirmasi "Perubahan belum disimpan" dan peringatan BR-013
    // keduanya render gray.700 di mode gelap, mengambang di atas navy.900.
    //
    // Multipart lagi, dan ini yang keenam: textarea.ts, card.ts, Table, Menu,
    // Popover, Modal. Enam-enamnya lolos typecheck, lint, dan build tanpa suara.
    Modal: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: {
          bg: mode("white", "navy.800")(props),
          borderRadius: "20px",
        },
        header: {
          color: mode("navy.700", "white")(props),
        },
        overlay: {
          // 40-60% hitam supaya isi depan tetap terbaca; bawaan Chakra terlalu
          // tipis di atas latar terang.
          bg: "blackAlpha.600",
        },
        closeButton: {
          color: mode("secondaryGray.600", "whiteAlpha.700")(props),
          borderRadius: "10px",
        },
      }),
    },
  },
};
