// Tailwind runs only on the public subtree's stylesheet -- the one file that
// imports "tailwindcss" (CLAUDE.md). Every other stylesheet passes through.
const config = { plugins: { '@tailwindcss/postcss': {} } }
export default config
