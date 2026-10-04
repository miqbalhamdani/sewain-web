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
      // gray.600 (#4A5568), bukan gray.400: di atas putih gray.400 cuma ~2,3:1,
      // di bawah batas 4,5:1 WCAG untuk teks biasa -- dan token ini dipakai
      // untuk SEMUA label di backoffice, yang sebagian pembacanya sudah
      // berumur. Nilai gelapnya sudah lolos dari dulu dan tidak disentuh.
      "text.secondary": { default: "gray.600", _dark: "whiteAlpha.700" },
      "border.subtle": { default: "gray.200", _dark: "whiteAlpha.100" },
      // Garis yang harus TERLIHAT, bukan sekadar memisahkan: penghubung
      // stepper, cincin nomor langkah. whiteAlpha.100 di atas kartu gelap
      // nyaris hilang untuk garis 2px.
      "border.strong": { default: "gray.300", _dark: "whiteAlpha.400" },
      "surface.hover": { default: "secondaryGray.300", _dark: "whiteAlpha.50" },
      "surface.sunken": { default: "secondaryGray.300", _dark: "whiteAlpha.100" },

      // Kalender (BR-033). Warna acuan dari tabel BR-033, tapi warna TIDAK
      // pernah jadi satu-satunya pembeda: tiap keadaan selain `available` juga
      // punya pola atau border di CalendarGrid, dan tiap blok berlabel teks.
      "calendar.available": { default: "green.50", _dark: "rgba(72, 187, 120, 0.12)" },
      "calendar.reserved_unpaid": { default: "blue.100", _dark: "blue.700" },
      "calendar.reserved_paid": { default: "blue.500", _dark: "blue.400" },
      "calendar.reservedBorder": { default: "blue.500", _dark: "blue.300" },
      "calendar.picked_up": { default: "orange.200", _dark: "orange.500" },
      "calendar.overdue": { default: "red.500", _dark: "red.500" },
      "calendar.buffer": { default: "gray.100", _dark: "gray.600" },
      "calendar.maintenance": { default: "gray.700", _dark: "gray.900" },
      "calendar.ink": { default: "gray.900", _dark: "white" },
      "calendar.inkOnDark": { default: "white", _dark: "white" },
      "calendar.grid": { default: "gray.200", _dark: "whiteAlpha.200" },
      // Band kolom hari ini — brand #4318FF ber-alpha tipis, overlay di atas blok.
      "calendar.todayBand": { default: "rgba(67, 24, 255, 0.05)", _dark: "rgba(255, 255, 255, 0.06)" },
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
