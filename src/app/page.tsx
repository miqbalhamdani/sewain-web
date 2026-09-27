import { redirect } from 'next/navigation'

/**
 * The root of `app.sewain.id`.
 *
 * Straight to the dashboard: the `(app)` guards bounce an anonymous visitor to
 * /login and an unverified one to /verify-email, so this does not have to know
 * which of the three is the right answer.
 */
export default function Page() {
  redirect('/dashboard')
}
