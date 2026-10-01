import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

/**
 * Textarea adalah komponen SATU-BAGIAN di Chakra v2, bukan multipart.
 *
 * Berkas ini dulu membungkus setiap gaya di `field: { … }`, disalin dari
 * input.ts. Itu benar untuk Input dan Select — keduanya punya `parts` — tapi
 * Chakra mendaftarkan Textarea lewat `defineStyleConfig` (tunggal) dan justru
 * MELEPAS `.field` dari tema Input sebelum memakainya
 * (@chakra-ui/theme/dist/components/textarea.js:224).
 *
 * Akibatnya seluruh berkas ini mati tanpa suara selama berbulan-bulan: kunci
 * `field` yang tidak dikenal selamat sebagai selektor keturunan, dan emotion
 * menerbitkan `.css-hash field { … }` yang menyasar elemen yang tidak ada. Nol
 * error, nol warning, nol gaya. Ia baru ketahuan waktu S1-087 merender Textarea
 * pertama di aplikasi ini dan sudutnya 6px di antara field 16px.
 *
 * Kalau menambah varian di sini, JANGAN salin bentuk input.ts. Gayanya datar.
 */
export const textareaStyles = {
  components: {
    Textarea: {
      baseStyle: {
        fontWeight: 400,
        borderRadius: "8px",
      },

      variants: {
        main: (props: StyleFunctionProps) => ({
          bg: mode("transparent", "navy.800")(props),
          border: "1px solid",
          color: mode("secondaryGray.900", "white")(props),
          borderColor: mode("secondaryGray.100", "whiteAlpha.100")(props),
          borderRadius: "16px",
          fontSize: "sm",
          p: "20px",
          _placeholder: { color: "secondaryGray.400" },
        }),

        // Disalin nilai per nilai dari Input.auth, dan itu bukan kerapian:
        // ketiganya berdiri bersebelahan di form yang sama, jadi satu warna
        // border yang berbeda langsung kelihatan. Sebelumnya di sini
        // `bg: "white"` hardcoded tanpa mode() -- menghidupkan kembali berkas
        // ini tanpa memperbaikinya justru akan memunculkan kotak putih terang
        // di antara dua field gelap.
        auth: (props: StyleFunctionProps) => ({
          fontSize: "sm",
          fontWeight: "500",
          color: mode("navy.700", "white")(props),
          bg: "transparent",
          border: "1px solid",
          borderColor: mode(
            "secondaryGray.100",
            "rgba(135, 140, 189, 0.3)"
          )(props),
          borderRadius: "16px",
          _placeholder: { color: "secondaryGray.600", fontWeight: "400" },
        }),

        authSecondary: (props: StyleFunctionProps) => ({
          fontSize: "sm",
          fontWeight: "500",
          color: mode("navy.700", "white")(props),
          bg: "transparent",
          border: "1px solid",
          borderColor: mode(
            "secondaryGray.100",
            "rgba(135, 140, 189, 0.3)"
          )(props),
          borderRadius: "16px",
          _placeholder: { color: "secondaryGray.600", fontWeight: "400" },
        }),

        search: () => ({
          border: "none",
          py: "11px",
          borderRadius: "inherit",
          _placeholder: { color: "secondaryGray.600" },
        }),
      },

      // Satu-satunya bentuk form yang dipakai aplikasi ini. Tanpa ini, Textarea
      // tanpa prop `variant` diam-diam dapat `outline` bawaan Chakra.
      defaultProps: {
        variant: "auth",
        size: "lg",
      },
    },
  },
};
