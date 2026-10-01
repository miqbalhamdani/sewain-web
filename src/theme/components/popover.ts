import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

export const popoverStyles = {
  components: {
    // Popover MULTIPART: gayanya bersarang di bawah nama part-nya (`content`,
    // `body`, ...), bukan datar di akar. Ini instans kelima dari jebakan yang
    // sama -- textarea.ts, card.ts, Table, Menu, sekarang Popover -- dan
    // kelimanya lolos typecheck, lint, dan build tanpa suara.
    Popover: {
      baseStyle: (props: StyleFunctionProps) => ({
        content: {
          // Sebelum berkas ini ada, Popover tidak terdaftar sama sekali dan
          // kalender di dalamnya render `gray.700` bawaan Chakra -- abu-abu
          // kehijauan mengambang di atas navy.800 milik modal di belakangnya.
          bg: mode("white", "navy.800")(props),
          borderColor: mode("gray.200", "whiteAlpha.100")(props),
          borderRadius: "20px",
          boxShadow: "14px 17px 40px 4px rgba(112, 144, 176, 0.18)",
          _focusVisible: { boxShadow: "14px 17px 40px 4px rgba(112, 144, 176, 0.18)" },
        },
        // Yang diposisikan popper adalah part `popper`, bukan `content`.
        // Menyetel zIndex di PopoverContent saja menempelkannya pada anak di
        // DALAM konteks stacking yang sudah dibuat pembungkus ber-z-index 10.
        popper: {
          zIndex: "popover",
        },
        arrow: {
          bg: mode("white", "navy.800")(props),
        },
        header: {
          borderColor: mode("gray.200", "whiteAlpha.100")(props),
        },
      }),
    },
  },
};
