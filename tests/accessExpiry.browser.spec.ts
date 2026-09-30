import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { setTimeout } from 'node:timers/promises'
import { accounts, asAccount, createAccessDatabase } from './helpers/accessDatabase'

type Account = typeof accounts.admin
type Database = Awaited<ReturnType<typeof createAccessDatabase>>
let db: Database
test.beforeEach(async () => { db = await createAccessDatabase() })
test.afterEach(async () => { await db.close() })

function sessionFor(account: Account) {
  const expires_at = Math.floor(Date.now() / 1000) + 3600
  const payload = Buffer.from(JSON.stringify({ sub: account.id, email: account.email, exp: expires_at, role: 'authenticated' })).toString('base64url')
  return { access_token: `test.${payload}.test`, refresh_token: 'local-only', token_type: 'bearer', expires_in: 3600, expires_at,
    user: { ...account, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: account.email }, identities: [], created_at: new Date().toISOString() } }
}

// All non-app traffic is intercepted. The browser uses real migration/RLS logic
// against local PostgreSQL; Google/Auth, HTTP transport and HexForge are simulated.
async function prepareContext(context: BrowserContext, account: Account, appOrigin = 'http://127.0.0.1:5182') {
  const session = sessionFor(account)
  await context.addInitScript(value => { if (!localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token', JSON.stringify(value)) }, session)
  await context.routeWebSocket('**/*', socket => socket.close())
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === appOrigin) return route.continue()
    if (url.origin === 'http://127.0.0.1:55441') return route.fulfill({ json: { data: [] } })
    if (url.origin !== 'http://127.0.0.1:55440') return route.abort('blockedbyclient')
    const token = request.headers().authorization?.replace(/^Bearer /, '')
    let caller: Account | null = null
    try {
      const sub = JSON.parse(Buffer.from(token?.split('.')[1] || '', 'base64url').toString()).sub
      caller = Object.values(accounts).find(candidate => candidate.id === sub) ?? null
    } catch { /* The local anonymous fixture has no JWT. */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, json: url.pathname.endsWith('/user') ? session.user : {} })
    }
    try {
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').pop()
        const body = request.postDataJSON()
        if (name === 'increment_bug_upvotes') {
          await asAccount(db, caller, 'select public.increment_bug_upvotes($1)', [body.bug_id])
          return route.fulfill({ json: null })
        }
        if (name !== 'set_profile_access_expiry') throw new Error(`Unexpected RPC ${name}`)
        await asAccount(db, caller, 'select public.set_profile_access_expiry($1,$2,$3)', [body.target_email, body.duration_hours, body.add_user ?? false])
        return route.fulfill({ json: null })
      }
      const table = url.pathname.split('/').pop()!
      if (!['profiles', 'bookings', 'rooms', 'courses', 'settings', 'bugs', 'logs'].includes(table)) throw new Error(`Unexpected table ${table}`)
      const values: unknown[] = []
      const filters: string[] = []
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(key)) continue
        const operators: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
        const dot = value.indexOf('.')
        const operator = value.slice(0, dot)
        const operand = value.slice(dot + 1)
        if (!/^[a-z_]+$/.test(key) || (!operators[operator] && operator !== 'in')) throw new Error(`Unsupported fixture filter ${key}`)
        values.push(operator === 'in' ? operand.slice(1, -1).split(',') : operand)
        filters.push(operator === 'in' ? `${key}=any($${values.length})` : `${key}${operators[operator]}$${values.length}`)
      }
      const where = filters.length ? ` where ${filters.join(' and ')}` : ''
      let sql = `select * from public.${table}${where}`
      if (request.method() === 'PATCH') {
        const assignments = Object.entries(request.postDataJSON()).map(([key, value]) => {
          if (!/^[a-z_]+$/.test(key)) throw new Error('Invalid fixture column')
          values.push(value)
          return `${key}=$${values.length}`
        })
        sql = `update public.${table} set ${assignments.join(',')}${where} returning *`
      } else if (request.method() === 'DELETE') sql = `delete from public.${table}${where} returning *`
      else if (request.method() === 'POST') {
        const body = request.postDataJSON()
        const inputs = Array.isArray(body) ? body : [body]
        const columns = Object.keys(inputs[0])
        if (!columns.length || !columns.every(key => /^[a-z_]+$/.test(key))) throw new Error('Invalid fixture columns')
        const tuples = inputs.map(input => '(' + columns.map(key => {
          const value = input[key]
          values.push(value && typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : value)
          return `$${values.length}`
        }).join(',') + ')')
        const upsert = table === 'settings' && url.searchParams.has('on_conflict') ? ' on conflict(key) do update set value=excluded.value' : ''
        sql = `insert into public.${table} (${columns.join(',')}) values ${tuples.join(',')}${upsert} returning *`
      }
      if (request.method() === 'GET' && url.searchParams.has('order')) {
        const order = url.searchParams.get('order')!.split(',').map(item => {
          const [column, direction] = item.split('.')
          if (!/^[a-z_]+$/.test(column) || !['asc', 'desc'].includes(direction)) throw new Error('Invalid fixture order')
          return `${column} ${direction}`
        })
        sql += ` order by ${order.join(',')}`
      }
      const { rows } = await asAccount(db, caller, sql, values)
      if (table === 'bookings') {
        for (const row of rows) row.booking_day = (row.booking_day as Date).toISOString().slice(0, 10)
        for (const [relation, foreignKey] of [['rooms', 'room_id'], ['courses', 'course_id']]) {
          if (!new RegExp(`${relation}\\s*\\(`).test(url.searchParams.get('select') || '')) continue
          const related = (await asAccount(db, caller, `select * from ${relation}`)).rows
          for (const row of rows) row[relation] = related.find(item => item.id === row[foreignKey]) || null
        }
      }
      if (request.headers().accept?.includes('application/vnd.pgrst.object+json')) {
        if (rows.length !== 1) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'Profile unavailable' } })
        return route.fulfill({ json: rows[0] })
      }
      return route.fulfill({ json: rows })
    } catch (error) {
      const failure = error as { code?: string, message: string }
      return route.fulfill({ status: 403, json: { code: failure.code || '42501', message: failure.message } })
    }
  })
}

async function openStaff(page: Page, context: BrowserContext) {
  await prepareContext(context, accounts.admin)
  await page.goto('/access')
  await expect(page.getByRole('button', { name: `Actions for ${accounts.user.email}`, exact: true })).toBeVisible()
}

async function chooseDuration(page: Page, label: string) {
  await page.getByLabel('Access expires', { exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function actions(page: Page, email: string) {
  await page.getByRole('button', { name: `Actions for ${email}`, exact: true }).click()
}

test('expiry UI stays within booking access, with inactive users collapsed', async ({ page, context }, testInfo) => {
  await openStaff(page, context)
  await expect(page.getByText('Inactive users (2)', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Actions for ${accounts.expired.email}`, exact: true })).not.toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('access-management.png'), fullPage: true })
  await page.getByRole('button', { name: 'Add User', exact: true }).click()
  await expect(page.getByLabel('Access expires', { exact: true })).toHaveText('Never')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await actions(page, accounts.user.email)
  for (const name of ['Set expiry date', 'Deactivate', 'Delete']) await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible()
})

test('add a normal Google user with Never, 8 hours, 24 hours or 7 days', async ({ page, context }) => {
  await openStaff(page, context)
  for (const [index, label] of ['Never', '8 hours', '24 hours', '7 days'].entries()) {
    const email = `added-${index}@example.com`
    await page.getByRole('button', { name: 'Add User', exact: true }).click()
    await page.getByRole('textbox', { name: /Gmail Address/ }).fill(email)
    await chooseDuration(page, label)
    await page.getByRole('button', { name: 'Add User', exact: true }).click()
    await expect(page.getByRole('button', { name: `Actions for ${email}`, exact: true })).toBeVisible()
    const { rows } = await db.query('select status,access_expires_at from profiles where email=$1', [email])
    expect(rows[0].status).toBe('pending')
    expect(rows[0].access_expires_at === null).toBe(index === 0)
  }
})

test('set expiry starts from save time and can be cleared to Never', async ({ page, context }) => {
  await openStaff(page, context)
  for (const label of ['8 hours', 'Never']) {
    await actions(page, accounts.user.email)
    await page.getByRole('menuitem', { name: 'Set expiry date', exact: true }).click()
    await chooseDuration(page, label)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Set expiry date', exact: true })).not.toBeVisible()
    const { rows } = await db.query('select extract(epoch from (access_expires_at-now()))/3600 as hours from profiles where email=$1', [accounts.user.email])
    if (label === 'Never') expect(rows[0].hours).toBeNull()
    else expect(Number(rows[0].hours)).toBeCloseTo(8, 1)
  }
})

test('deactivate moves a user into the collapsed section; activate asks for duration', async ({ page, context }) => {
  await openStaff(page, context)
  await actions(page, accounts.user.email)
  await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click()
  await expect(page.getByText('Inactive users (3)', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Actions for ${accounts.user.email}`, exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Inactive users (3)' }).click()
  await actions(page, accounts.user.email)
  await page.getByRole('menuitem', { name: 'Activate', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Activate user', exact: true })).toBeVisible()
  await chooseDuration(page, '24 hours')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Inactive users (2)', { exact: true })).toBeVisible()
  const { rows } = await db.query('select id,settings,authorisation,extract(epoch from (access_expires_at-now()))/3600 as hours from profiles where email=$1', [accounts.user.email])
  expect(rows[0].id).toBe(accounts.user.id)
  expect(rows[0].settings).toBe(false)
  expect(rows[0].authorisation).toBe(false)
  expect(Number(rows[0].hours)).toBeCloseTo(24, 1)
})

test('delete still requires confirmation and removes the profile', async ({ page, context }) => {
  await openStaff(page, context)
  page.on('dialog', dialog => dialog.accept())
  await actions(page, accounts.user.email)
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: `Actions for ${accounts.user.email}`, exact: true })).not.toBeVisible()
  expect((await db.query('select * from profiles where email=$1', [accounts.user.email])).rows).toHaveLength(0)
})

test('separate staff and user sessions: deactivation closes the user screen without logout', async ({ page, context, browser }) => {
  await openStaff(page, context)
  const userContext = await browser.newContext()
  try {
    await prepareContext(userContext, accounts.user)
    const userPage = await userContext.newPage()
    await userPage.goto('http://127.0.0.1:5182/document')
    await expect(userPage).toHaveURL(/\/document$/)
    await expect(userPage.getByRole('button', { name: 'Sign in with Google' })).not.toBeVisible()
    await actions(page, accounts.user.email)
    await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click()
    await expect(page.getByText('Inactive users (3)', { exact: true })).toBeVisible()
    await userPage.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(userPage).toHaveURL(/\/login$/)
    await expect(userPage.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeVisible()
    await expect(asAccount(db, accounts.user, 'delete from bookings returning id')).rejects.toThrow('Access expired or inactive')
    await expect(page).toHaveURL(/\/access$/)
  } finally { await userContext.close() }
})

test('expired Google login and direct protected URLs are rejected', async ({ page, context }) => {
  await prepareContext(context, accounts.expired)
  await page.goto('/login')
  await expect(page.getByText('Access denied, contact admin for access')).toBeVisible()
  await page.goto('/access')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Add User', exact: true })).not.toBeVisible()
})

test('normal pending Google login still activates the identity and respects staff permissions', async ({ page, context }) => {
  await prepareContext(context, accounts.pending)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/bookings$/)
  const { rows } = await db.query('select id,status from profiles where email=$1', [accounts.pending.email])
  expect(rows[0].id).toBe(accounts.pending.id)
  expect(rows[0].status).toBe('active')
  await page.goto('/access')
  await expect(page).toHaveURL(/\/bookings$/)
  await expect(page.getByRole('button', { name: 'Add User', exact: true })).not.toBeVisible()
})

test('an open user screen closes at its expiry without any user interaction', async ({ page, context }) => {
  await prepareContext(context, accounts.user)
  await db.query("update profiles set access_expires_at=now()+interval '3 seconds' where email=$1", [accounts.user.email])
  await page.goto('/document')
  await expect(page.locator('main')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/, { timeout: 7000 })
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeVisible()
})

test('a stale staff screen does not report a successful delete when backend permission is removed', async ({ page, context }) => {
  await openStaff(page, context)
  await db.query('update profiles set authorisation=false where email=$1', [accounts.admin.email])
  page.on('dialog', dialog => dialog.accept())
  await actions(page, accounts.user.email)
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Failed to delete user', { exact: true })).toBeVisible()
  expect((await db.query('select * from profiles where email=$1', [accounts.user.email])).rows).toHaveLength(1)
})

test('permanent users retain room booking CRUD and desktop search', async ({ page, context }, testInfo) => {
  await prepareContext(context, accounts.user)
  await page.goto('/bookings')
  await expect(page.locator('main').getByText('user', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'BOOK', exact: true }).click()
  const panel = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^New Booking/ }) })
  await panel.getByLabel('Room', { exact: true }).click()
  await page.getByRole('option', { name: /^Room 1/ }).click()
  await panel.getByLabel('Start Time', { exact: true }).fill('13:00')
  await panel.getByLabel('Duration', { exact: true }).click()
  await page.getByRole('option', { name: /^60 mins/ }).click()
  await panel.getByLabel('Staff Name', { exact: true }).fill('Regression booking')
  await panel.locator('.MuiFormControl-root').filter({ has: page.locator('label').filter({ hasText: /^Course$/ }) }).locator('.MuiSelect-select').click()
  await page.getByRole('option', { name: 'Course 1', exact: true }).click()
  await panel.getByRole('button', { name: 'Reserve', exact: true }).click()
  await expect(panel).not.toBeVisible()
  await expect(page.locator('main').getByText('Regression booking', { exact: true })).toBeVisible()
  await page.locator('main').getByText('Regression booking', { exact: true }).click()
  const edit = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^Edit Booking/ }) })
  await edit.getByLabel('Staff Name', { exact: true }).fill('Updated booking')
  await edit.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(page.locator('main').getByText('Updated booking', { exact: true })).toBeVisible()
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: 'SEARCH', exact: true }).click()
    await page.getByPlaceholder('Search student number...').fill('Updated booking')
    await expect(page.getByText('13:00 - 14:00', { exact: true })).toBeVisible()
    await page.getByText('13:00 - 14:00', { exact: true }).click()
    // Search highlights a booking; it does not edit it.
    await page.reload()
  }
  await page.locator('main').getByText('Updated booking', { exact: true }).click()
  await edit.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Delete Booking', exact: true }) }).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.locator('main').getByText('Updated booking', { exact: true })).not.toBeVisible()
  expect((await db.query('select id from bookings')).rows).toHaveLength(1)
})

test('permanent users retain maintenance, bug reporting, bug votes, collections and permission limits', async ({ page, context }) => {
  await prepareContext(context, accounts.user)
  await page.goto('/maintenance')
  await page.locator('button[title="Lights"]').click()
  await expect.poll(async () => (await db.query('select dynamic_labels from rooms where id=1')).rows[0].dynamic_labels).toContain('Lights 💡')
  await page.goto('/bug')
  await page.getByLabel('Your Name', { exact: true }).fill('Regression user')
  await page.getByLabel('Bug Description', { exact: true }).fill('Regression issue')
  await page.getByRole('button', { name: 'Submit Report', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Regression issue', exact: true })).toBeVisible()
  await page.getByRole('row').filter({ hasText: 'Regression issue' }).getByRole('button').click()
  await expect.poll(async () => (await db.query("select upvotes from bugs where description='Regression issue'")).rows[0].upvotes).toBe(1)
  for (const path of ['/collections', '/document']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
  for (const path of ['/settings', '/report', '/access']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/bookings$/)
  }
})

test('expiry assigned to an already-open Never session is detected automatically', async ({ page, context }) => {
  await page.clock.install()
  await prepareContext(context, accounts.user)
  await page.goto('/document')
  await expect(page.locator('main')).toBeVisible()
  await db.query("update profiles set access_expires_at=now()+interval '100 milliseconds' where email=$1", [accounts.user.email])
  await setTimeout(150)
  await expect(asAccount(db, accounts.user, 'delete from bookings returning id')).rejects.toThrow('Access expired or inactive')
  await page.clock.fastForward(60_000)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeVisible()
})
