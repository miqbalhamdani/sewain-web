import { randomUUID } from 'node:crypto'

import { expect, test, type Browser, type Page } from '@playwright/test'

import {
  backdateDraft, booking, bookingIdByCode, fireScheduler, goPublic, login, newOwner, seedCatalog,
  tenantURL, wallClock, type Catalog, type Owner,
} from './support'

/**
 * S1-071: the public page end to end -- a renter on <slug>.<apex> asks for a
 * booking, the operator confirms it in the backoffice, the renter's portal
 * follows. Plus the two cases the backlog names: a subdomain nobody owns, and
 * a draft nobody confirmed in time.
 *
 * One rental for the whole file, so CI needs exactly one known host
 * ($E2E_SLUG) in /etc/hosts.
 */
test.describe.serial('halaman publik', () => {
  const slug = process.env.E2E_SLUG ?? `e2e-${randomUUID().slice(0, 8)}`
  let owner: Owner
  let cat: Catalog

  test.beforeAll(async () => {
    owner = await newOwner('public')
    cat = await seedCatalog(owner)
    await goPublic(owner, slug)
  })

  /**
   * A renter's request through the public page, starting `day` days from now
   * (each case its own dates: the one unit is held once confirmed); its code
   * and portal link.
   */
  async function request(browser: Browser, name: string, phone: string, day: number) {
    const renter = await (await browser.newContext()).newPage()
    await renter.goto(`${tenantURL(slug)}/?mulai=${wallClock(day)}&selesai=${wallClock(day + 1)}`)
    await expect(renter.getByRole('heading', { name: owner.business })).toBeVisible()
    await renter.getByRole('link', { name: new RegExp(cat.resourceName) }).click()
    await expect(renter.getByRole('heading', { name: 'Syarat & ketentuan' })).toBeVisible()
    await renter.waitForLoadState('networkidle') // hydrated before the form is used
    // The plate never reaches the public page (BR-025).
    expect(await renter.locator('main').innerText()).not.toContain(cat.unitCode)
    await renter.locator('input[autocomplete=name]').fill(name)
    await renter.locator('input[autocomplete=tel]').fill(phone)
    await renter.getByRole('button', { name: 'Kirim pengajuan' }).click()
    await expect(renter.getByText('Pengajuan terkirim, menunggu konfirmasi pemilik')).toBeVisible()
    const code = (await renter.locator('[role=status] strong').innerText()).trim()
    const track = await renter.getByRole('link', { name: 'Pantau pengajuan' }).getAttribute('href')
    return { renter, code, track: track as string }
  }

  async function portalSays(renter: Page, track: string, status: string) {
    await renter.goto(track)
    await expect(renter.getByText(status, { exact: true }).first()).toBeVisible()
  }

  test('pengajuan → draft → dikonfirmasi operator', async ({ page, browser }) => {
    const { renter, code, track } = await request(browser, 'Rina Publik', '081355550001', 1)
    await portalSays(renter, track, 'Menunggu konfirmasi pemilik')
    const id = await bookingIdByCode(owner, code)
    expect((await booking(owner, id)).status).toBe('draft')

    await login(page, owner)
    await page.goto(`/bookings/${id}`)
    await page.getByRole('button', { name: 'Konfirmasi booking' }).first().click()
    await expect.poll(async () => (await booking(owner, id)).status).toBe('reserved')

    // The renter's portal follows, and now carries the bill and the bank.
    await portalSays(renter, track, 'Dikonfirmasi')
    await expect(renter.getByText('BCA 1234567890')).toBeVisible()
  })

  test('subdomain asing → halaman tidak ditemukan', async ({ browser }) => {
    const visitor = await (await browser.newContext()).newPage()
    const res = await visitor.goto(`${tenantURL(`nobody-${slug}`)}/`)
    expect(res?.status()).toBe(404)
    await expect(visitor.getByText('Halaman tidak ditemukan')).toBeVisible()
  })

  test('draft kedaluwarsa → dibatalkan otomatis', async ({ browser }) => {
    const { renter, code, track } = await request(browser, 'Dodi Telat', '081355550002', 5)
    const id = await bookingIdByCode(owner, code)

    // Its 24 hours are up; the sweep runs now instead of at the next 5-minute slot.
    await backdateDraft(slug, code)
    fireScheduler()
    await expect.poll(async () => (await booking(owner, id)).status, { timeout: 30_000 }).toBe('cancelled')
    await portalSays(renter, track, 'Dibatalkan')
  })
})
