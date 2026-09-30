import { test, expect, type BrowserContext, type APIRequestContext, type Page } from '@playwright/test'

const backend=`http://127.0.0.1:${process.env.BOOKINGS_TEST_API_PORT || 55439}`
const app=`http://127.0.0.1:${process.env.BOOKINGS_TEST_SITE_PORT || 5175}`
async function session(request: APIRequestContext, kind='admin') {
  return (await request.post(`${backend}/__session`,{ data:{kind} })).json()
}
async function seed(context: BrowserContext, tokens: unknown) {
  await context.addInitScript((value)=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),tokens)
}
async function code(request: APIRequestContext) {
  const tokens=await session(request)
  const response=await request.post(`${backend}/functions/v1/temporary-access`,{
    headers:{Authorization:`Bearer ${tokens.access_token}`}, data:{action:'create',label:'Workshop assistant',duration_hours:24},
  })
  expect(response.status()).toBe(201)
  return response.json()
}
async function login(page: Page, accessCode: string) {
  await page.goto(`${app}/login`)
  await page.getByLabel(/^Access code/).fill(accessCode)
  await page.getByRole('button',{name:'Sign in with access code',exact:true}).click()
  await expect(page).toHaveURL(/\/bookings$/)
  await page.getByRole('button',{name:'open drawer',exact:true}).click()
  await expect(page.locator('.MuiDrawer-paper').getByText('Workshop assistant',{exact:true})).toBeVisible()
}
test.beforeEach(async ({ request })=> { expect((await request.post(`${backend}/__reset`)).ok()).toBe(true) })

test('code login works, survives reload and blocks direct Collections and administration routes',async ({page,request})=>{
  const generated=await code(request)
  const sockets: string[]=[]
  page.on('websocket',socket=>sockets.push(socket.url()))
  await login(page,generated.code.toLowerCase())
  await expect(page.getByText('3D Print Collection',{exact:true})).toHaveCount(0)
  await expect(page.getByText('Manage Users',{exact:true})).toHaveCount(0)
  await page.reload()
  await expect(page).toHaveURL(/\/bookings$/)
  for (const route of ['/collections','/access','/settings','/report']) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/bookings$/)
  }
  expect(sockets).toHaveLength(0)
})

test('Access Control staff generate a code once and remove it, blocking another open session',async ({page,context,request,browser},testInfo)=>{
  await seed(context,await session(request))
  await page.goto('/access')
  await page.getByLabel('Temporary user name').fill('Workshop assistant')
  await page.getByRole('button',{name:'Generate code',exact:true}).click()
  const output=page.getByLabel('Generated access code')
  await expect(output).toBeVisible()
  expect(await output.evaluate(element=>element.scrollWidth <= element.clientWidth+1)).toBe(true)
  await page.screenshot({path:testInfo.outputPath('generated-code.png')})
  const accessCode=await output.inputValue()
  await page.getByRole('button',{name:'Done',exact:true}).click()
  await expect(output).toHaveCount(0)
  const guestContext=await browser.newContext()
  const guest=await guestContext.newPage()
  await login(guest,accessCode)
  await page.getByRole('button',{name:'Remove',exact:true}).click()
  await page.getByRole('button',{name:'Remove access',exact:true}).click()
  await expect(page.getByText('Removed',{exact:true})).toBeVisible()
  await guest.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(guest).toHaveURL(/\/login$/)
  await guest.getByLabel(/^Access code/).fill(accessCode)
  await guest.getByRole('button',{name:'Sign in with access code',exact:true}).click()
  await expect(guest.getByText('Invalid or expired access code.')).toBeVisible()
  await guestContext.close()
})

test('removal blocks existing-token booking writes before polling and clears the open browser without signing out',async ({page,request})=>{
  const generated=await code(request)
  const admin=await session(request)
  const adminHeaders={Authorization:`Bearer ${admin.access_token}`}
  const day=new Date()
  const date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`
  const booking={room_id:1,course_id:1,booking_day:date,start_time:'08:00',end_time:'09:00',booked_by:'Workshop assistant'}
  const saved=await request.post(`${backend}/rest/v1/bookings`,{headers:adminHeaders,data:booking})
  expect(saved.ok()).toBe(true)
  const [original]=await saved.json()
  await page.clock.install()
  await login(page,generated.code)
  await page.getByRole('button',{name:'Close navigation',exact:true}).click()
  await expect(page.getByText('Engineering',{exact:true})).toBeVisible()
  await page.getByText('Engineering',{exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true})).toBeVisible()
  await page.clock.pauseAt(new Date(Date.now()+1000))
  const guest=await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-127-auth-token')!))
  const guestHeaders={Authorization:`Bearer ${guest.access_token}`}
  const removed=await request.post(`${backend}/rest/v1/rpc/revoke_temporary_access_code`,{
    headers:adminHeaders,data:{p_id:generated.id},
  })
  expect(removed.ok()).toBe(true)

  // The original, unexpired token is reused while the old booking screen is cached.
  const insert=await request.post(`${backend}/rest/v1/bookings`,{
    headers:guestHeaders,data:{...booking,start_time:'10:00',end_time:'11:00'},
  })
  expect(insert.status()).toBe(403)
  const update=await request.patch(`${backend}/rest/v1/bookings?id=eq.${original.id}`,{
    headers:guestHeaders,data:{booked_by:'Unauthorized change'},
  })
  expect(await update.json()).toEqual([])
  const read=await request.get(`${backend}/rest/v1/bookings`,{headers:guestHeaders})
  expect(await read.json()).toEqual([])

  await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click()
  await page.getByRole('dialog').filter({hasText:'Delete this booking?'}).getByRole('button',{name:'Delete',exact:true}).click()
  await expect(page.getByText(/Delete failed: No bookings were deleted/)).toBeVisible()
  await expect(page.getByText('Deleted: Booking deleted',{exact:true})).toHaveCount(0)
  const persisted=await request.get(`${backend}/rest/v1/bookings?id=eq.${original.id}`,{headers:adminHeaders})
  expect((await persisted.json())[0].booked_by).toBe('Workshop assistant')

  await page.clock.fastForward(16000)
  await expect(page).toHaveURL(/\/login$/)
})

test('ordinary tabs share an account, so switching to staff changes the identity used by the other tab',async ({page,context,request})=>{
  const generated=await code(request)
  await login(page,generated.code)
  const guestId=await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-127-auth-token')!).user.id)
  const admin=await session(request)
  expect(guestId).not.toBe(admin.user.id)
  const staff=await context.newPage()
  // Bootstrap outside the app, matching the demo's staff sign-in page.
  await staff.route(`${app}/__seed`,route=>route.fulfill({contentType:'text/html',body:'<title>Test staff sign-in</title>'}))
  await staff.goto(`${app}/__seed`)
  await staff.evaluate(tokens=>localStorage.setItem('sb-127-auth-token',JSON.stringify(tokens)),admin)
  await staff.goto(`${app}/access`)
  await expect(staff.getByLabel('Temporary user name')).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/bookings$/)
  await page.getByRole('button',{name:'open drawer',exact:true}).click()
  await expect(page.getByText('Access Staff',{exact:true})).toBeVisible()
  await expect(page.getByText('3D Print Collection',{exact:true})).toBeVisible()
})

test('the same code allows separate sessions and logout affects only the current device',async ({page,request,browser})=>{
  const generated=await code(request)
  await login(page,generated.code)
  const otherContext=await browser.newContext()
  const other=await otherContext.newPage()
  await login(other,generated.code)
  await page.getByText('Sign Out',{exact:true}).click()
  await expect(page).toHaveURL(/\/login$/)
  await other.reload()
  await expect(other).toHaveURL(/\/bookings$/)
  await otherContext.close()
})

test('expiry removes access from an open browser and rejects another login',async ({page,request})=>{
  const generated=await code(request)
  await login(page,generated.code)
  await request.post(`${backend}/__expire`,{data:{id:generated.id}})
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel(/^Access code/).fill(generated.code)
  await page.getByRole('button',{name:'Sign in with access code',exact:true}).click()
  await expect(page.getByText('Invalid or expired access code.')).toBeVisible()
})

test('Google sign-in still activates a pending regular user and retains Collections',async ({page})=>{
  await page.goto('/login')
  await page.getByRole('button',{name:'Sign in with Google',exact:true}).click()
  await expect(page).toHaveURL(/\/bookings$/)
  await page.getByRole('button',{name:'open drawer',exact:true}).click()
  await expect(page.getByText('Google User',{exact:true})).toBeVisible()
  await expect(page.getByText('3D Print Collection',{exact:true})).toBeVisible()
})

test('invalid codes show a safe error; the mobile login form fits the viewport',async ({page},testInfo)=>{
  await page.goto('/login')
  await expect(page.getByRole('button',{name:'Sign in with Google',exact:true})).toBeEnabled()
  await page.screenshot({path:testInfo.outputPath('login.png')})
  await page.getByLabel(/^Access code/).fill('123456')
  await page.getByRole('button',{name:'Sign in with access code',exact:true}).click()
  await expect(page.getByText('Invalid or expired access code.')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('temporary users create, update and delete a booking through the normal booking form',async ({page,request})=>{
  test.setTimeout(45000)
  const generated=await code(request)
  await login(page,generated.code)
  await page.getByRole('button',{name:'Close navigation',exact:true}).click()
  await page.getByRole('button',{name:'Book',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByLabel('Staff Name')).toHaveValue('Workshop assistant')
  await dialog.getByLabel('Room', {exact:true}).click()
  await page.getByRole('option',{name:/Room A/}).click()
  const day=new Date()
  day.setDate(day.getDate()+1)
  while ([0,6].includes(day.getDay())) day.setDate(day.getDate()+1)
  const date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`
  const dateInput=dialog.getByLabel('Date',{exact:true})
  await dateInput.focus()
  await expect(dateInput).toHaveAttribute('type','date')
  await dateInput.fill(date)
  await dialog.getByLabel('Start Time').fill('08:00')
  await dialog.getByLabel('Duration',{exact:true}).click()
  await page.getByRole('option',{name:/^60 mins/}).click()
  await dialog.getByRole('combobox').last().click()
  await page.getByRole('option',{name:'Engineering',exact:true}).click()
  await dialog.getByLabel('Student Numbers').fill('1234567')
  await dialog.getByRole('button',{name:'Reserve',exact:true}).click()
  await expect(page.getByText('Saved: Booking created',{exact:true})).toBeVisible()
  await expect(dialog).toHaveCount(0)
  const toolbarDate=page.locator('input').first()
  await toolbarDate.focus()
  await expect(toolbarDate).toHaveAttribute('type','date')
  await toolbarDate.fill(date)
  await toolbarDate.blur()
  await page.getByText('Engineering',{exact:true}).click()
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Student Numbers').fill('7654321')
  await dialog.getByRole('button',{name:'Update',exact:true}).click()
  await expect(page.getByText('Updated: Booking updated',{exact:true})).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await page.getByText('Engineering',{exact:true}).click()
  await expect(dialog.getByLabel('Student Numbers')).toHaveValue('7654321')
  await dialog.getByRole('button',{name:'Delete',exact:true}).click()
  await page.getByRole('dialog').filter({hasText:'Delete this booking?'}).getByRole('button',{name:'Delete',exact:true}).click()
  await expect(page.getByText('Deleted: Booking deleted',{exact:true})).toBeVisible()
  await expect(page.getByText('Engineering',{exact:true})).toHaveCount(0)
})

test('temporary users save maintenance labels and submit and upvote bug reports',async ({page,request})=>{
  const generated=await code(request)
  await login(page,generated.code)
  await page.goto('/maintenance')
  await page.getByTitle('Lights',{exact:true}).click()
  await page.reload()
  await expect(page.getByText('Needs Attention',{exact:true})).toBeVisible()
  await expect(page.getByTitle('Lights',{exact:true})).toHaveClass(/MuiButton-contained/)
  await page.goto('/bug')
  await page.getByLabel('Your Name').fill('Workshop assistant')
  await page.getByLabel('Bug Description').fill('Temporary user feedback')
  await page.getByRole('button',{name:'Submit Report',exact:true}).click()
  await expect(page.getByText('Bug reported successfully.',{exact:true})).toBeVisible()
  const row=page.getByRole('row').filter({hasText:'Temporary user feedback'})
  await expect(row).toBeVisible()
  await row.getByRole('button',{name:'Upvote',exact:true}).click()
  await expect(row.getByRole('cell',{name:'1',exact:true})).toBeVisible()
})
