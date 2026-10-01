import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

/**
 * Table tidak pernah terdaftar di theme.tsx, jadi kedua tabel katalog memakai
 * bawaan Chakra dan mengoper `borderColor` ke setiap Th dan Td -- delapan belas
 * kali, identik, di dua berkas.
 *
 * Gayanya ditulis di `variants.simple`, bukan `baseStyle`, karena varian menang
 * atas baseStyle dan Chakra sendiri menaruh borderColor tabelnya di varian itu.
 * baseStyle di sini akan kalah dan hilang tanpa suara -- sudah dicoba, dan
 * bordernya jatuh ke `currentColor`.
 *
 * `mode()` dan bukan token semantik: token semantik bekerja sebagai prop
 * komponen tapi tidak resolve di dalam objek gaya tema seperti ini. Seluruh
 * berkas tema lain di repo ini juga memakai mode().
 */
export const tableStyles = {
  components: {
    Table: {
      variants: {
        simple: (props: StyleFunctionProps) => ({
          th: {
            borderColor: mode("gray.200", "whiteAlpha.100")(props),
            color: mode("secondaryGray.600", "whiteAlpha.600")(props),
            // Bawaan Chakra uppercase + letterSpacing "wider". Di kolom sempit
            // "UNIT AKTIF" pecah satu huruf per baris; huruf biasa muat.
            textTransform: "none",
            letterSpacing: "normal",
            fontWeight: "600",
            fontSize: "xs",
          },
          td: {
            borderColor: mode("gray.200", "whiteAlpha.100")(props),
          },
        }),
      },
    },
  },
};
