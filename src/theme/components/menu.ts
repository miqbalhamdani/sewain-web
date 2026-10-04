import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

export const menuStyles = {
  components: {
    // Menu adalah komponen MULTIPART: gayanya harus bersarang di bawah nama
    // part-nya (`list`, `item`, …), bukan datar di akar. Persis jebakan yang
    // sudah memakan textarea.ts dan card.ts -- dan seperti keduanya, versi
    // datarnya lolos typecheck, lint, dan build tanpa suara.
    Menu: {
      baseStyle: (props: StyleFunctionProps) => ({
        list: {
          // Sebelum berkas ini ada, Menu tidak terdaftar sama sekali dan
          // MenuList render `gray.700` bawaan Chakra -- abu-abu kehijauan
          // mengambang di atas navy.800 milik kartu di bawahnya.
          bg: mode("white", "navy.800")(props),
          borderColor: mode("gray.200", "whiteAlpha.100")(props),
          borderRadius: "16px",
          boxShadow: "14px 17px 40px 4px rgba(112, 144, 176, 0.18)",
          py: "8px",
        },
        item: {
          bg: "transparent",
          color: mode("navy.700", "white")(props),
          fontSize: "sm",
          // Baris menu adalah sasaran sentuh juga: 44px, bukan 30px bawaan.
          minH: "44px",
          _hover: { bg: mode("secondaryGray.300", "whiteAlpha.100")(props) },
          _focus: { bg: mode("secondaryGray.300", "whiteAlpha.100")(props) },
        },
        groupTitle: {
          color: mode("secondaryGray.600", "whiteAlpha.600")(props),
          fontSize: "xs",
        },
      }),
    },
  },
};
