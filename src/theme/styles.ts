import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";
export const globalStyles = {
  colors: {
    brand: {
      100: "#E9E3FF",
      200: "#422AFB",
      300: "#422AFB",
      400: "#7551FF",
      500: "#422AFB",
      600: "#3311DB",
      700: "#02044A",
      800: "#190793",
      900: "#11047A",
    },
    brandScheme: {
      100: "#E9E3FF",
      200: "#7551FF",
      300: "#7551FF",
      400: "#7551FF",
      500: "#422AFB",
      600: "#3311DB",
      700: "#02044A",
      800: "#190793",
      900: "#02044A",
    },
    brandTabs: {
      100: "#E9E3FF",
      200: "#422AFB",
      300: "#422AFB",
      400: "#422AFB",
      500: "#422AFB",
      600: "#3311DB",
      700: "#02044A",
      800: "#190793",
      900: "#02044A",
    },
    secondaryGray: {
      100: "#E0E5F2",
      200: "#E1E9F8",
      300: "#F4F7FE",
      400: "#E9EDF7",
      500: "#8F9BBA",
      600: "#A3AED0",
      700: "#707EAE",
      800: "#707EAE",
      900: "#1B2559",
    },
    red: {
      100: "#FEEFEE",
      500: "#EE5D50",
      600: "#E31A1A",
    },
    blue: {
      50: "#EFF4FB",
      500: "#3965FF",
    },
    orange: {
      100: "#FFF6DA",
      500: "#FFB547",
    },
    green: {
      100: "#E6FAF5",
      500: "#01B574",
    },
    navy: {
      50: "#d0dcfb",
      100: "#aac0fe",
      200: "#a3b9f8",
      300: "#728fea",
      400: "#3652ba",
      500: "#1b3bbb",
      600: "#24388a",
      700: "#1B254B",
      800: "#111c44",
      900: "#0b1437",
    },
    gray: {
      100: "#FAFCFE",
    },
  },
  // Token semantik: nama peran, bukan nama warna.
  //
  // Ada karena empat layar katalog menurunkan pasangan yang sama sendiri-sendiri
  // lewat useColorModeValue, delapan belas kali, dan dua di antaranya menyimpang:
  // layar daftar memakai secondaryGray.900 untuk teks utama, layar form memakai
  // navy.700. Keduanya #1B25xx -- beda satu kanal, praktis tak terlihat -- tapi
  // itu tetap dua sumber kebenaran untuk satu peran, dan yang berikutnya akan
  // menambah yang ketiga.
  //
  // Dipakai sebagai `color="text.primary"`, tanpa hook, jadi komponen berhenti
  // tahu soal mode warna sama sekali.
  semanticTokens: {
    colors: {
      "text.primary": { default: "secondaryGray.900", _dark: "white" },
      // Nilai terangnya sengaja tidak diubah supaya perapian layout ini tidak
      // ikut menggeser rupa. Yang diperbaiki: dulu ia literal 'gray.400' di
      // sembilan berkas dan TIDAK ikut berubah di mode gelap sama sekali.
      "text.secondary": { default: "gray.400", _dark: "whiteAlpha.700" },
      "border.subtle": { default: "gray.200", _dark: "whiteAlpha.100" },
      "surface.hover": { default: "secondaryGray.300", _dark: "whiteAlpha.50" },
      "surface.sunken": { default: "secondaryGray.300", _dark: "whiteAlpha.100" },
    },
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        overflowX: "hidden",
        bg: mode("secondaryGray.300", "navy.900")(props),
        fontFamily: "DM Sans",
        letterSpacing: "-0.5px",
      },
      // Selektor elemen global, dan ia cuma kena <input> -- bukan <textarea>
      // maupun <select>. Tanpa mode(), ketiga tipe field itu mengatakan hal
      // yang berbeda di mode gelap: teks input nyaris hitam di atas latar
      // gelap, dua lainnya putih.
      input: {
        color: mode("gray.700", "white")(props),
      },
      html: {
        fontFamily: "DM Sans",
      },
    }),
  },
};
