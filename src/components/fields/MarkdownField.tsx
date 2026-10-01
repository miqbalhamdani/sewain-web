'use client'

import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react'
import { Extension, type Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useId } from 'react'

type MarkdownFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void

  /**
   * Kalimat "Contoh: …" yang jadi placeholder, dan yang disalin tombol
   * "Pakai contoh" jadi isi sungguhan.
   *
   * Wajib diisi, tidak didefault: field tanpa contoh di form ini adalah field
   * yang akan dibiarkan kosong. PRD §3.1 sudah menyatakan juragan tidak mengisi
   * data master sebelum produknya berguna, dan contoh yang tinggal diganti
   * angkanya adalah satu-satunya cara memperpendek jaraknya.
   */
  example: string

  maxLength: number
  helper?: string
  error?: string
}

/**
 * Menolak ketukan yang membuat **markdown hasil serialisasinya** melewati batas.
 *
 * Batasnya ada pada yang tersimpan, bukan pada yang terlihat: `CHECK
 * (char_length(description) <= 500)` mengukur `**AC dingin**` sebagai 15
 * karakter, bukan 9. `CharacterCount` bawaan Tiptap menghitung teks dokumen,
 * jadi ia alat yang salah di sini dan sengaja tidak dipakai.
 *
 * Di `filterTransaction`, bukan di `onUpdate`: menolak transaksinya menjaga
 * kursor di tempat, sementara mengembalikan isi sesudahnya akan melemparkan
 * kursor ke ujung tiap kali batasnya tersentuh. Ini juga yang membuat paste
 * ikut terbatasi, sama seperti `maxLength` pada `<textarea>` dulu.
 */
const LimitMarkdown = Extension.create<{ maxLength: number }>({
  name: 'limitMarkdown',
  addOptions() {
    return { maxLength: Infinity }
  },
  addProseMirrorPlugins() {
    const { editor, options } = this
    return [
      new Plugin({
        filterTransaction(tr) {
          if (!tr.docChanged) return true
          const md = serialize(editor, tr.doc)
          return md === null || md.length <= options.maxLength
        },
        props: {
          // Tempelan DIPOTONG, tidak ditolak. `filterTransaction` sendirian
          // menjatuhkan tempelan 600 karakter seluruhnya -- juragan menempel dan
          // tidak terjadi apa-apa, tanpa penjelasan. `<textarea maxLength>` yang
          // digantikan komponen ini memotongnya, dan itu yang benar.
          //
          // Mengetik di batas tetap ditolak per ketukan, dan itu juga persis
          // perilaku textarea.
          transformPastedText(text) {
            const sekarang = serialize(editor)
            if (sekarang === null) return text
            const sisa = options.maxLength - sekarang.length
            return text.length <= sisa ? text : text.slice(0, Math.max(sisa, 0))
          },
        },
      }),
    ]
  },
})

type MarkdownStorage = {
  serializer?: { serialize: (doc: unknown) => string }
  getMarkdown?: () => string
}

/** Serialisasi aman: mengembalikan null kalau storage-nya belum siap. */
function serialize(editor: Editor, doc?: unknown): string | null {
  // Lewat unknown: tiptap-markdown tidak memperluas tipe `Storage` milik Tiptap
  // v3, jadi `editor.storage.markdown` tidak ada di tipenya meski ada di runtime.
  const storage = (editor.storage as unknown as Record<string, MarkdownStorage | undefined>)
    .markdown
  if (storage === undefined) return null
  if (doc !== undefined && storage.serializer !== undefined) {
    return storage.serializer.serialize(doc)
  }
  return storage.getMarkdown?.() ?? null
}

/**
 * Teks panjang dengan format seperlunya: tebal, miring, daftar.  (S1-087, BR-095)
 *
 * WYSIWYG di permukaan, **markdown di penyimpanan**. Itu bukan kompromi setengah
 * jalan, itu keputusan BR-095: halaman publik M5 merender teks ini, dan teks yang
 * dirender apa adanya jadi permukaan serangan kalau ia HTML. Markdown gagal dengan
 * jinak.
 */
export function MarkdownField({
  label,
  value,
  onChange,
  example,
  maxLength,
  helper,
  error,
}: MarkdownFieldProps) {
  const labelId = useId()

  const borderColor = useColorModeValue('secondaryGray.100', 'rgba(135, 140, 189, 0.3)')
  const textColor = useColorModeValue('navy.700', 'white')
  const placeholderColor = useColorModeValue('secondaryGray.600', 'whiteAlpha.500')

  const editor = useEditor({
    // Wajib di App Router: tanpa ini Tiptap ikut dirender di server dan
    // hidrasinya tidak cocok.
    immediatelyRender: false,
    extensions: [
      // Yang dimatikan itu disengaja. BR-095 menulis "tebal, miring, dan daftar
      // berbutir. Tidak lebih" -- dan yang tidak ada di kontrak tidak boleh bisa
      // diketik, karena halaman publik M5 tidak akan merendernya.
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        orderedList: false,
        link: false,
        underline: false,
      }),
      Markdown.configure({ breaks: true, transformPastedText: true }),
      LimitMarkdown.configure({ maxLength }),
    ],
    content: value,
    editorProps: {
      attributes: {
        // contentEditable bukan kontrol form: ia tidak dapat satu pun dari ini
        // secara gratis, tidak seperti <textarea> yang digantikannya.
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        'aria-invalid': error !== undefined ? 'true' : 'false',
      },
    },
    onUpdate: ({ editor }) => {
      const md = serialize(editor)
      if (md !== null) onChange(md)
    },
  })

  // Isi dari luar (muat awal, "Pakai contoh") disalurkan masuk. Dijaga supaya
  // tidak menimpa dirinya sendiri: tiap ketukan mengirim markdown ke atas lalu
  // menerimanya balik, dan setContent tanpa penjaga ini akan melempar kursor ke
  // ujung di tiap huruf.
  useEffect(() => {
    if (editor === null) return
    const current = serialize(editor)
    if (current !== null && current.trim() === value.trim()) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  const remaining = maxLength - value.length

  return (
    <FormControl isInvalid={error !== undefined} mb="20px">
      <Flex align="center" justify="space-between" gap="12px" mb="6px">
        <FormLabel id={labelId} ms="4px" mb="0" fontSize="sm" fontWeight="500" color="text.primary">
          {label}
        </FormLabel>
        {value === '' && (
          <Button
            type="button"
            variant="link"
            size="sm"
            colorScheme="brand"
            // Tombolnya hilang begitu ada isinya: menawarkan "pakai contoh" pada
            // teks yang sudah ditulis juragan adalah tawaran menghapus
            // pekerjaannya sendiri.
            onClick={() => {
              const text = example.replace(/^Contoh:\s*/, '')
              editor?.commands.setContent(text)
              onChange(text)
            }}
          >
            Pakai contoh
          </Button>
        )}
      </Flex>

      <Flex gap="4px" mb="6px" ms="4px">
        <ToolbarButton
          label="Tebal"
          aktif={editor?.isActive('bold') ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          fontWeight="700"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="Miring"
          aktif={editor?.isActive('italic') ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          fontStyle="italic"
        >
          I
        </ToolbarButton>
        <ToolbarButton
          label="Daftar"
          aktif={editor?.isActive('bulletList') ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
      </Flex>

      <Box
        border="1px solid"
        borderColor={error !== undefined ? 'red.500' : borderColor}
        borderRadius="16px"
        px="16px"
        py="12px"
        fontSize="sm"
        color={textColor}
        // Cincin fokus dipasang tangan: :focus-visible tidak berlaku ke pembungkus
        // ini, dan yang benar-benar fokus adalah anak contentEditable-nya.
        _focusWithin={{ borderColor: 'brand.500', boxShadow: 'outline' }}
        sx={{
          '.ProseMirror': { minH: '86px', outline: 'none' },
          '.ProseMirror p': { mb: '4px' },
          '.ProseMirror ul': { ps: '20px', listStyleType: 'disc' },
          // Placeholder sendiri: Tiptap tidak punya bawaan tanpa ekstensinya,
          // dan satu pseudo-elemen lebih ringan daripada satu paket lagi.
          '.ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            color: placeholderColor,
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>

      {error !== undefined ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : (
        <Flex justify="space-between" gap="12px" mt="6px">
          <Text fontSize="xs" color="text.secondary">
            {helper ?? 'Blok teksnya dulu, lalu tekan tombol format — atau ⌘B / ⌘I.'}
          </Text>
          <Text
            fontSize="xs"
            whiteSpace="nowrap"
            color={remaining < 50 ? 'orange.500' : 'text.secondary'}
          >
            {remaining} karakter tersisa
          </Text>
        </Flex>
      )}
    </FormControl>
  )
}

/**
 * Satu tombol format. Ikon huruf, bukan SVG: B/I/• sudah dikenali di mana-mana
 * dan menambah set ikon untuk tiga glif bukan penghematan.
 */
function ToolbarButton({
  label,
  aktif,
  onClick,
  children,
  ...text
}: {
  label: string
  aktif: boolean
  onClick: () => void
  children: string
  fontWeight?: string
  fontStyle?: string
}) {
  return (
    <Tooltip label={label} openDelay={400}>
      <Button
        type="button"
        aria-label={label}
        // Sekarang keadaan tertekan PUNYA nilai -- ia mengikuti posisi kursor --
        // jadi ia harus diumumkan, tidak seperti versi textarea dulu.
        aria-pressed={aktif}
        onClick={onClick}
        variant="outline"
        size="sm"
        h="32px"
        minW="32px"
        px="0"
        borderRadius="8px"
        color={aktif ? 'brand.500' : 'text.secondary'}
        borderColor={aktif ? 'brand.500' : undefined}
        _hover={{ color: 'brand.500' }}
        {...text}
      >
        {children}
      </Button>
    </Tooltip>
  )
}
