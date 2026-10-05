import { expect, test } from '@playwright/test'

import { booking, login, newOwner, PHOTO, seedCatalog } from './support'

/**
 * S1-070: one full rental cycle through the backoffice, the way an operator
 * does it -- booking, payment, pickup handover, return handover, deposit
 * settled, booking completed. The data behind it is seeded through the API;
 * every step a person takes is a click.
 */
test('booking → serah-terima → deposit selesai', async ({ page }) => {
  const owner = await newOwner('cycle')
  const cat = await seedCatalog(owner)
  await login(page, owner)

  // Booking: tomorrow 09:00 → the day after, the form's own default.
  await page.goto('/bookings/new')
  await page.getByPlaceholder('Budi / 0812…').fill(cat.customerName)
  await page.getByRole('button', { name: new RegExp(cat.customerName) }).click()
  await page.getByText(cat.unitCode, { exact: true }).click()
  await page.getByRole('button', { name: 'Simpan booking' }).click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)
  const bookingURL = page.url()

  // Payment: the first invoice (rent + deposit), cash at the counter. The step
  // card's button only scrolls to Tagihan; the invoice's own button pays.
  await page.locator('#tagihan').getByRole('button', { name: 'Catat pembayaran' }).click()
  const pay = page.getByRole('dialog')
  await pay.getByRole('button', { name: /Tunai/ }).click()
  await pay.getByRole('button', { name: /^Catat lunas/ }).click()
  await expect(pay).toBeHidden()

  // Pickup handover: photo, odometer, checklist.
  await page.getByRole('button', { name: 'Serah-terima ambil' }).first().click()
  await page.waitForURL(/\/pickup$/)
  await page.locator('input[type=file]').first().setInputFiles(PHOTO)
  await page.getByLabel(/odometer|kilometer/i).fill('10100')
  for (const box of await page.getByRole('checkbox').all()) await box.check()
  await page.getByRole('button', { name: /Simpan|Serahkan/ }).last().click()
  await page.waitForURL(bookingURL)

  // Return handover.
  await page.getByRole('button', { name: 'Terima kembali' }).first().click()
  await page.waitForURL(/\/return$/)
  await page.locator('input[type=file]').first().setInputFiles(PHOTO)
  await page.getByLabel(/odometer|kilometer/i).fill('10350')
  await page.getByRole('button', { name: /Simpan|Terima/ }).last().click()
  await page.waitForURL(bookingURL)

  // Deposit back in full (the panel's button, not the step card's scroll),
  // then the booking closes.
  await page.locator('#deposit').getByRole('button', { name: 'Selesaikan deposit' }).click()
  await expect(page.locator('#deposit').getByText(/dikembalikan/i).first()).toBeVisible()
  await page.getByRole('button', { name: 'Selesaikan booking' }).first().click()

  // And the record agrees: completed, paid, the whole deposit returned. Polled,
  // because the screen's toast and the request finishing are not the same moment.
  const id = bookingURL.split('/').pop() as string
  await expect.poll(async () => (await booking(owner, id)).status).toBe('completed')
  const b = await booking(owner, id)
  expect(b.payment.status).toBe('paid')
  expect(b.deposit_settled_at).not.toBeNull()
  expect(b.deposit_refunded).toBe(500000)
})
