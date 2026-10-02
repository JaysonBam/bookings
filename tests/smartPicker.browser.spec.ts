import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { accounts, createAccessDatabase } from './helpers/accessDatabase'
import { prepareBookingContext } from './helpers/bookingBrowser'

type Account = typeof accounts.admin
type Database = Awaited<ReturnType<typeof createAccessDatabase>>
let db: Database
test.beforeEach(async () => { db = await createAccessDatabase() })
test.afterEach(async () => { await db.close() })

const prepareContext = (context: BrowserContext, account: Account, appOrigin?: string) => prepareBookingContext(context, db, account, appOrigin)

const panelFor = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^New Booking/ }) });
async function setDate(input: ReturnType<Page['getByLabel']>, value: string) {
  await input.focus(); await input.fill(value); await input.press('Tab');
}
async function openPicker(page: Page, context: BrowserContext) {
  await db.exec(`delete from bookings;
    insert into settings(key,value) values ('testing_clock','{"enabled":true,"date":"2026-10-02","time":"12:00"}');
    update rooms set min_people=4;
    insert into rooms(name,max_people,min_people) values ('Room 2',8,1);`);
  await prepareContext(context, accounts.user);
  await page.goto('/bookings');
  await expect(page.getByRole('button', { name: 'BOOK', exact: true })).toBeVisible();
  await expect(page.locator('input').first()).toHaveValue('02/10/2026');
  await page.getByRole('button', { name: 'BOOK', exact: true }).click();
  return panelFor(page);
}
async function smart(page: Page) {
  page.once('dialog', dialog => dialog.accept('4'));
  await panelFor(page).getByRole('button', { name: 'Smart Select', exact: true }).click();
}
test('BOOK retains the future date selected on the schedule', async ({page,context}) => {
  await openPicker(page,context);
  await panelFor(page).getByRole('button',{name:'Cancel',exact:true}).click();
  await setDate(page.locator('input').first(),'2026-10-03');
  await page.getByRole('button',{name:'BOOK',exact:true}).click();
  await expect(panelFor(page).getByLabel('Date',{exact:true})).toHaveValue('03/10/2026');
});
async function chooseDuration(page: Page, minutes: number) {
  await panelFor(page).getByLabel('Duration', { exact: true }).click();
  await page.getByRole('option', { name: new RegExp(`^${minutes} mins`) }).click();
}

test('date, time and duration changes invalidate the old Next recommendations',async ({page,context})=>{
  const panel=await openPicker(page,context);
  await panel.getByLabel('Start Time',{exact:true}).fill('13:00');
  await smart(page);
  await expect(panel.getByRole('button',{name:/^Next/})).toBeVisible();
  await setDate(panel.getByLabel('Date',{exact:true}),'2026-10-03');
  await expect(panel.getByRole('button',{name:'Smart Select',exact:true})).toBeVisible();
  await smart(page);
  await expect(panel.getByRole('button',{name:/^Next/})).toBeVisible();
  await panel.getByLabel('Start Time',{exact:true}).fill('14:00');
  await expect(panel.getByRole('button',{name:'Smart Select',exact:true})).toBeVisible();
  await smart(page);
  await expect(panel.getByRole('button',{name:/^Next/})).toBeVisible();
  await chooseDuration(page, 90);
  await expect(panel.getByRole('button',{name:'Smart Select',exact:true})).toBeVisible();
});

test('future recommendation preserves 90 minutes and saves the chosen day and times', async ({ page, context }, testInfo) => {
  const panel = await openPicker(page, context);
  await db.exec("insert into bookings(room_id,booking_day,start_time,end_time,booked_by) values (1,'2026-10-03','13:30','14:30','Already reserved')");
  await setDate(panel.getByLabel('Date', { exact: true }), '2026-10-03');
  await panel.getByLabel('Start Time', { exact: true }).fill('13:00');
  await chooseDuration(page, 90);
  await smart(page);
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Room 2');
  await expect(panel.getByLabel('Duration', { exact: true })).toHaveText('90 mins');
  await expect(panel.getByRole('button', { name: 'Next (1/2)', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Next (1/2)', exact: true }).click();
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Room 1 (Available for 30 min)');
  await expect(panel.getByLabel('Duration', { exact: true })).toHaveText('30 mins');
  await panel.getByRole('button', { name: 'Next (2/2)', exact: true }).click();
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Room 2');
  await expect(panel.getByLabel('Duration', { exact: true })).toHaveText('90 mins');
  await page.screenshot({ path: testInfo.outputPath('future-recommendation.png') });
  await panel.getByLabel('Staff Name', { exact: true }).fill('Picker verification');
  await panel.locator('.MuiFormControl-root').filter({ has: page.locator('label').filter({ hasText: /^Course$/ }) }).locator('.MuiSelect-select').click();
  await page.getByRole('option', { name: 'Course 1', exact: true }).click();
  await panel.getByRole('button', { name: 'Reserve', exact: true }).click();
  await expect(panel).not.toBeVisible();
  const { rows } = await db.query("select room_id,booking_day::text,start_time,end_time from bookings where booked_by='Picker verification'");
  expect(rows).toEqual([{ room_id: 2, booking_day: '2026-10-03', start_time: '13:00:00', end_time: '14:30:00' }]);
});

test('a two-hour request offers shorter alternatives and Next keeps cycling', async ({ page, context }, testInfo) => {
  const panel = await openPicker(page, context);
  await db.exec(`insert into bookings(room_id,booking_day,start_time,end_time,booked_by) values
    (1,'2026-10-03','14:30','15:00','Existing reservation'),
    (2,'2026-10-03','14:00','15:00','Existing reservation')`);
  await setDate(panel.getByLabel('Date', { exact: true }), '2026-10-03');
  await panel.getByLabel('Start Time', { exact: true }).fill('13:00');
  await chooseDuration(page, 120);
  await smart(page);
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Room 1 (Available for 1 hr 30 min)');
  await expect(panel.getByLabel('Duration', { exact: true })).toHaveText('90 mins');
  await expect(panel.getByRole('button', { name: 'Next (1/2)', exact: true })).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath('shorter-alternative.png') });
  await panel.getByRole('button', { name: 'Next (1/2)', exact: true }).click();
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Room 2 (Available for 1 hr)');
  await expect(panel.getByLabel('Duration', { exact: true })).toHaveText('60 mins');
  await panel.getByRole('button', { name: 'Next (2/2)', exact: true }).click();
  await expect(panel.getByLabel('Duration', { exact: true })).toHaveText('90 mins');
  await expect(panel.getByRole('button', { name: 'Next (1/2)', exact: true })).toBeVisible();
});

test('a delayed response for an old date cannot change the new date availability', async ({ page, context }) => {
  const panel = await openPicker(page, context);
  await db.exec("insert into bookings(room_id,booking_day,start_time,end_time,booked_by) values (1,'2026-10-04','13:30','14:30','Already reserved')");
  await panel.getByLabel('Room', { exact: true }).click();
  await page.getByRole('option', { name: /^Room 1/ }).click();
  await panel.getByLabel('Start Time', { exact: true }).fill('13:00');
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requestArrived = new Promise<void>(resolve => { arrived = resolve; });
  await page.route('**/rest/v1/bookings*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('booking_day') === 'eq.2026-10-03') {
      arrived(); await gate;
      return route.fulfill({ json: [] });
    }
    return route.fallback();
  });
  await setDate(panel.getByLabel('Date', { exact: true }), '2026-10-03');
  await requestArrived;
  await setDate(panel.getByLabel('Date', { exact: true }), '2026-10-04');
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Available for 30 min');
  const oldResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('booking_day') === 'eq.2026-10-03');
  release(); await oldResponse;
  await expect(panel.getByLabel('Room', { exact: true })).toContainText('Available for 30 min');
  await panel.getByLabel('Duration', { exact: true }).click();
  await expect(page.getByRole('option', { name: /^30 mins/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /^60 mins/ })).not.toBeVisible();
});

test('changing time while Smart Select is fetching discards the old result', async ({ page, context }) => {
  const panel = await openPicker(page, context);
  await panel.getByLabel('Start Time', { exact: true }).fill('13:00');
  await smart(page);
  await expect(panel.getByRole('button', { name: /^Next/ })).toBeVisible();
  await panel.getByLabel('Start Time', { exact: true }).fill('14:00');
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requestArrived = new Promise<void>(resolve => { arrived = resolve; });
  await page.route('**/rest/v1/bookings*', async route => {
    arrived(); await gate;
    return route.fulfill({ json: [] });
  });
  await smart(page);
  await requestArrived;
  await panel.getByLabel('Start Time', { exact: true }).fill('15:00');
  const oldResponse = page.waitForResponse('**/rest/v1/bookings*');
  release(); await oldResponse;
  await expect(panel.getByRole('button', { name: 'Smart Select', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /^Next/ })).not.toBeVisible();
});

test('closing time returns no suggestion and a failed request does not report availability', async ({ page, context }) => {
  const panel = await openPicker(page, context);
  await panel.getByLabel('Start Time', { exact: true }).fill('21:00');
  await smart(page);
  await expect(page.getByText('No rooms found: No rooms fit this group with at least 30 minutes available within opening hours.', { exact: true })).toBeVisible();
  await panel.getByLabel('Start Time', { exact: true }).fill('13:00');
  await page.route('**/rest/v1/bookings*', route => route.fulfill({ status: 500, json: { message: 'Local availability failure' } }));
  await smart(page);
  await expect(page.getByText('Unavailable: Could not load availability data. Please try Smart Select again.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /^Next/ })).not.toBeVisible();
});
