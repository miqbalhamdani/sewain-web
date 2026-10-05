/**
 * One answer for an unknown host, an inactive rental, a page not live yet, and a
 * resource or booking that is not there (BR-030) -- this page never says which.
 */
export default function NotFound() {
  return (
    <main className="py-24 text-center">
      <h1 className="text-xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-stone-500">Periksa lagi alamatnya, atau tanyakan tautannya ke pemilik rental.</p>
    </main>
  )
}
