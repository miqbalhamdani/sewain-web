import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";
export const buttonStyles = {
  components: {
    Button: {
      baseStyle: {
        borderRadius: "16px",
        boxShadow: "45px 76px 113px 7px rgba(112, 144, 176, 0.08)",
        transition: ".25s all ease",
        boxSizing: "border-box",
        // _focusVisible, bukan _focus yang dicabut. Template Horizon
        // menghapusnya sama sekali, jadi TIDAK ADA satu pun tombol di aplikasi
        // ini yang terlihat saat di-Tab -- termasuk Simpan dan Batal. Sama
        // seperti switch.ts: aksesibilitas dasar, bukan pilihan gaya.
        _focusVisible: {
          boxShadow: "outline",
        },
        _active: {
          boxShadow: "none",
        },
      },
      // 46px adalah tinggi tombol aplikasi ini, dan sebelumnya ia ditulis
      // `h="46px"` di enam tempat -- dua di antaranya lupa, jadi layar katalog
      // kosong menampilkan tombol yang tingginya beda dari yang muncul begitu
      // ada satu baris data.
      sizes: {
        // 44px adalah sasaran sentuh minimum (HIG/WCAG), dan `size="sm"` dipakai
        // untuk tombol aksi di kartu tagihan dan deposit -- yang ditekan juragan
        // di HP, di parkiran. Bawaan Chakra 32px terlalu kecil untuk itu.
        sm: {
          h: "44px",
          minW: "44px",
          fontSize: "sm",
          px: "16px",
        },
        lg: {
          h: "46px",
          minW: "46px",
          fontSize: "sm",
          px: "24px",
        },
      },
      defaultProps: {
        size: "lg",
      },
      variants: {
        outline: () => ({
          borderRadius: "16px",
        }),
        // Tidak ada di tema ini sebelumnya, jadi `variant="link"` jatuh ke
        // bawaan Chakra -- yang menggarisbawahi saat hover. Dan `baseStyle` di
        // atas menempelkan radius 16px + bayangan jatuh sebesar kartu ke SETIAP
        // tombol, tanpa di-scope per varian: tombol yang seharusnya tampil
        // sebagai teks ikut membawanya.
        link: (props: StyleFunctionProps) => ({
          boxShadow: "none",
          borderRadius: "0",
          px: "0",
          height: "auto",
          minW: "auto",
          // Garis bawah adalah satu-satunya umpan balik hover yang tombol ini
          // punya, jadi ia diganti, bukan sekadar dibuang.
          //
          // brand.400 di gelap, bukan brand.300: brand.200, .300, dan .500 di
          // palet ini hex-nya SAMA PERSIS (#422AFB), jadi hover ke .300 tidak
          // mengubah satu piksel pun dan umpan baliknya benar-benar hilang.
          // Pasangan .600/.400 ini yang juga dipakai varian `brand`.
          _hover: {
            textDecoration: "none",
            color: mode("brand.600", "brand.400")(props),
          },
          _active: {
            textDecoration: "none",
          },
        }),
        brand: (props: StyleFunctionProps) => ({
          bg: mode("brand.500", "brand.400")(props),
          color: "white",
          _focus: {
            bg: mode("brand.500", "brand.400")(props),
          },
          _active: {
            bg: mode("brand.500", "brand.400")(props),
          },
          _hover: {
            bg: mode("brand.600", "brand.400")(props),
          },
        }),
        darkBrand: (props: StyleFunctionProps) => ({
          bg: mode("brand.900", "brand.400")(props),
          color: "white",
          _focus: {
            bg: mode("brand.900", "brand.400")(props),
          },
          _active: {
            bg: mode("brand.900", "brand.400")(props),
          },
          _hover: {
            bg: mode("brand.800", "brand.400")(props),
          },
        }),
        lightBrand: (props: StyleFunctionProps) => ({
          bg: mode("#F2EFFF", "whiteAlpha.100")(props),
          color: mode("brand.500", "white")(props),
          _focus: {
            bg: mode("#F2EFFF", "whiteAlpha.100")(props),
          },
          _active: {
            bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          },
          _hover: {
            bg: mode("secondaryGray.400", "whiteAlpha.200")(props),
          },
        }),
        light: (props: StyleFunctionProps) => ({
          bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          color: mode("secondaryGray.900", "white")(props),
          _focus: {
            bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          },
          _active: {
            bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          },
          _hover: {
            bg: mode("secondaryGray.400", "whiteAlpha.200")(props),
          },
        }),
        action: (props: StyleFunctionProps) => ({
          fontWeight: "500",
          borderRadius: "50px",
          bg: mode("secondaryGray.300", "brand.400")(props),
          color: mode("brand.500", "white")(props),
          _focus: {
            bg: mode("secondaryGray.300", "brand.400")(props),
          },
          _active: { bg: mode("secondaryGray.300", "brand.400")(props) },
          _hover: {
            bg: mode("secondaryGray.200", "brand.400")(props),
          },
        }),
        setup: (props: StyleFunctionProps) => ({
          fontWeight: "500",
          borderRadius: "50px",
          bg: mode("transparent", "brand.400")(props),
          border: mode("1px solid", "0px solid")(props),
          borderColor: mode("secondaryGray.400", "transparent")(props),
          color: mode("secondaryGray.900", "white")(props),
          _focus: {
            bg: mode("transparent", "brand.400")(props),
          },
          _active: { bg: mode("transparent", "brand.400")(props) },
          _hover: {
            bg: mode("secondaryGray.100", "brand.400")(props),
          },
        }),
      },
    },
  },
};
