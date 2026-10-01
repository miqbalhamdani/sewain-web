import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

/**
 * Card di Chakra v2 MULTIPART -- bagiannya container/header/body/footer.
 *
 * Berkas ini dulu memberi `baseStyle` datar, disalin dari pola komponen
 * satu-bagian. Bug yang persis sama dengan textarea.ts, dan ini instans
 * ketiganya: `<Card>` membaca `styles.container`, sementara gayanya ditaruh di
 * akar, jadi radius 20px dan latar navy.800 tidak pernah berlaku. Yang dirender
 * adalah bawaan Chakra: radius 6px dan `chakra-body-bg`.
 *
 * Itu sebabnya setiap pemanggil menulis padding-nya sendiri -- di layar katalog
 * ada lima nilai berbeda untuk tiga peran kartu. Sekarang perannya yang dinamai,
 * bukan angkanya yang ditebak.
 */
const Card = {
  baseStyle: (props: StyleFunctionProps) => ({
    container: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      position: "relative",
      minWidth: "0px",
      wordWrap: "break-word",
      borderRadius: "20px",
      bg: mode("#ffffff", "navy.800")(props),
      backgroundClip: "border-box",
      boxShadow: "none",
    },
  }),

  variants: {
    // Kartu isi: form, detail, apa pun yang punya judul dan field.
    section: { container: { p: "24px" } },

    // Kartu pesan: empty state dan galat. Lebih lega karena isinya sedikit dan
    // di tengah, jadi padding kecil membuatnya terlihat seperti galat.
    panel: { container: { p: "32px", textAlign: "center" } },

    // Pembungkus tabel: nol padding, karena sel tabel punya paddingnya sendiri.
    // overflow hidden supaya sudut tabel ikut melengkung mengikuti kartunya.
    table: { container: { p: "0", overflowX: "auto", overflowY: "hidden" } },
  },

  defaultProps: {
    variant: "section",
  },
};

export const CardComponent = {
  components: {
    Card,
  },
};
