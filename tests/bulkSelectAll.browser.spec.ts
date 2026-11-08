import { test, expect } from '@playwright/test'
import { accounts, createAccessDatabase } from './helpers/accessDatabase'
import { prepareBookingContext } from './helpers/bookingBrowser'

test('select all rooms supports partial selection, individual changes and bulk save', async ({ page, context }, testInfo) => {
  const db = await createAccessDatabase()
  try {
    await db.exec(`delete from bookings;
      insert into settings(key,value) values ('testing_clock','{"enabled":true,"date":"2026-10-02","time":"12:00"}');
      insert into rooms(name,max_people,min_people) select 'Room ' || n,8,1 from generate_series(2,12) n;`)
    await prepareBookingContext(context, db, accounts.user)
    await page.goto('/bookings')
    await expect(page.locator('input').first()).toHaveValue('02/10/2026')
    await page.getByRole('button', { name: 'BOOK', exact: true }).click()
    const panel = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^New Booking/ }) })
    await panel.getByLabel('Bulk Mode', { exact: true }).check()
    const rooms = panel.getByRole('group', { name: 'Rooms', exact: true })
    const selectAll = panel.getByRole('button', { name: 'Select all', exact: true })
    await expect(rooms.getByRole('checkbox')).toHaveCount(12)
    await rooms.getByRole('checkbox', { name: 'Room 1', exact: true }).check()
    await selectAll.click()
    await expect(rooms.locator('input:checked')).toHaveCount(12)
    await expect(selectAll).toBeDisabled()
    await rooms.getByRole('checkbox', { name: 'Room 1', exact: true }).uncheck()
    await expect(rooms.locator('input:checked')).toHaveCount(11)
    await expect(selectAll).toBeEnabled()
    await selectAll.click()
    await expect(rooms.locator('input:checked')).toHaveCount(12)
    await expect(rooms).toHaveJSProperty('scrollWidth', await rooms.evaluate(el => el.clientWidth))
    const bounds = await selectAll.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await page.screenshot({ path: testInfo.outputPath('bulk-select-all.png') })
    await testInfo.attach('All rooms selected', { path: testInfo.outputPath('bulk-select-all.png'), contentType: 'image/png' })
    for (const name of ['Start date, range 1', 'End date, range 1']) {
      const input = panel.getByRole('textbox', { name, exact: true })
      await input.fill('03/10/2026')
      await input.press('Tab')
    }
    await panel.getByLabel('Start time, range 1', { exact: true }).fill('13:00')
    await panel.getByLabel('End time, range 1', { exact: true }).fill('14:00')
    await panel.getByLabel('Staff Name', { exact: true }).fill('Select all verification')
    await panel.getByLabel('Course', { exact: true }).click()
    await page.getByRole('option', { name: 'Course 1', exact: true }).click()
    await panel.getByRole('button', { name: 'Reserve', exact: true }).click()
    await expect(panel).not.toBeVisible()
    const { rows } = await db.query("select room_id, bulk_booking_id from bookings where booked_by='Select all verification' order by room_id")
    expect(rows.map(row => row.room_id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
    expect(new Set(rows.map(row => row.bulk_booking_id)).size).toBe(1)
  } finally { await db.close() }
})
