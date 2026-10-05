import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { expect, type Page } from '@playwright/test'
import pg from 'pg'

/**
 * What the suites need from outside the browser: a fresh rental through the
 * real API (register → Mailpit link → verify → login), its catalogue, and two
 * levers no screen offers -- backdating a draft and firing the scheduler once.
 *
 * Every run makes its own owner, so the suites can run against a database that
 * already holds data without colliding with it.
 */

export const APEX = process.env.E2E_APEX ?? 'sewain.localhost'
export const PROXY_PORT = process.env.E2E_PROXY_PORT ?? '8088'
export const appURL = process.env.E2E_APP_URL ?? `http://app.${APEX}:${PROXY_PORT}`
export const tenantURL = (slug: string) => `http://${slug}.${APEX}:${PROXY_PORT}`

const API = `${appURL}/api/v1`
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'
const PASSWORD = 'rahasia-e2e-12345'

export type Owner = { email: string; password: string; token: string; business: string }

async function call<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${text}`)
  return (text ? JSON.parse(text) : undefined) as T
}

/** The link the API mailed to `to`, read back from Mailpit (BR-006). */
async function mailedToken(to: string, marker: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()
    if (found.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${found.messages[0].ID}`)).json()
      const token = new RegExp(`${marker}([A-Za-z0-9_-]+)`).exec(msg.Text)?.[1]
      if (token) return token
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no mail with ${marker} reached ${to}`)
}

/** A fresh, verified vehicle rental, signed in through the API. */
export async function newOwner(tag: string): Promise<Owner> {
  const id = randomUUID().slice(0, 8)
  const email = `e2e-${tag}-${id}@example.com`
  const business = `E2E ${tag} ${id}`
  await call('/auth/register', { method: 'POST',
    body: { email, password: PASSWORD, business_name: business, business_type: 'vehicle_rental' } })
  await call('/auth/verify-email', { method: 'POST', body: { token: await mailedToken(email, 'verify-email\\?token=') } })
  const session = await call<{ access_token: string }>('/auth/login', { method: 'POST', body: { email, password: PASSWORD } })
  return { email, password: PASSWORD, token: session.access_token, business }
}

export type Catalog = { resourceId: string; resourceName: string; unitCode: string; customerName: string }

/** One car with a deposit and a late fee, one unit, one renter. */
export async function seedCatalog(o: Owner): Promise<Catalog> {
  const n = Math.floor(1000 + Math.random() * 8999)
  const resourceName = `Avanza E2E ${n}`
  const res = await call<{ id: string }>('/resources', { method: 'POST', token: o.token, body: {
    name: resourceName, base_price: 350000, deposit_amount: 500000, late_fee_per_unit: 100000,
    buffer_minutes: 0, requires_id_verification: false,
    vehicle: { vehicle_type: 'car', transmission: 'manual', seats: 7, fuel: 'gasoline' } } })
  const unitCode = `AB ${n} EE`
  await call(`/resources/${res.id}/units`, { method: 'POST', token: o.token,
    body: { code: unitCode, meter_value: 10000, vehicle: { year: 2021, color: 'Putih' } } })
  const customerName = `Sari E2E ${n}`
  await call('/customers', { method: 'POST', token: o.token, body: { name: customerName, phone: `0812${n}${n}` } })
  return { resourceId: res.id, resourceName, unitCode, customerName }
}

/** A live public page (BR-096) with a bank account for the portal (S1-062). */
export async function goPublic(o: Owner, slug: string) {
  await call('/settings', { method: 'PATCH', token: o.token, body: {
    slug, whatsapp: '+628123456789', address: 'Jl. E2E No. 1, Sleman',
    bank_name: 'BCA', bank_account_number: '1234567890', bank_account_holder: 'Pemilik E2E' } })
}

/** A booking's id from its code, within one rental. */
export async function bookingIdByCode(o: Owner, code: string) {
  const page = await call<{ data: { id: string; code: string }[] }>(`/bookings?code=${encodeURIComponent(code)}`, { token: o.token })
  const hit = page.data.find((b) => b.code === code)
  if (!hit) throw new Error(`no booking ${code}`)
  return hit.id
}

/** The booking as the API sees it -- what the screens claim, checked at the source. */
export async function booking(o: Owner, id: string) {
  return call<{ status: string; deposit_settled_at: string | null; deposit_refunded: number;
    payment: { status: string } }>(`/bookings/${id}`, { token: o.token })
}

export async function login(page: Page, o: Owner) {
  await page.goto('/login')
  await page.locator('input[name=email]').fill(o.email)
  await page.locator('input[autocomplete=current-password]').fill(o.password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await page.waitForURL('**/dashboard')
}

/**
 * Pretend a draft's 24 hours are up: no screen moves time, so the schema owner
 * does, for exactly one draft of exactly one rental (picked by slug + code --
 * codes repeat across rentals).
 */
export async function backdateDraft(slug: string, code: string) {
  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL
    ?? process.env.DATABASE_URL ?? 'postgres://localhost:5432/sewain_dev?sslmode=disable' })
  await client.connect()
  try {
    const r = await client.query(
      `UPDATE bookings b SET expires_at = now() - interval '1 minute'
         FROM owners o
        WHERE o.id = b.owner_id AND o.slug = $1 AND b.code = $2 AND b.status = 'draft'`, [slug, code])
    expect(r.rowCount, `draft ${code} of ${slug}`).toBe(1)
  } finally {
    await client.end()
  }
}

/** `scheduler -once`: enqueue the expiry sweep now; the running worker does it. */
export function fireScheduler() {
  execSync(process.env.E2E_SCHEDULER ?? 'go run ./cmd/scheduler -once', {
    cwd: process.env.E2E_API_DIR ?? '../sewain-api', stdio: 'inherit' })
}

/** Tomorrow and the day after as the datetime-local the screens take, in WIB. */
export function wallClock(daysFromNow: number, hour = 9) {
  const d = new Date(Date.now() + daysFromNow * 86_400_000)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)
  return `${day}T${String(hour).padStart(2, '0')}:00`
}

/** A tiny JPEG for handover photos and transfer proofs. */
export const PHOTO = 'e2e/fixtures/photo.jpg'
