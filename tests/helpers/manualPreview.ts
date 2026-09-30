// Interactive local demo: the same isolated database and API used by the tests.
import { spawn } from 'node:child_process'

const children = new Set<ReturnType<typeof spawn>>()
let stopping = false
const environment = {
  ...process.env,
  BOOKINGS_LOCAL_DEMO: 'true',
  VITE_SUPABASE_URL: 'http://127.0.0.1:55439',
  VITE_SUPABASE_ANON_KEY: 'test-public-key',
  VITE_HEXFORGE_SUPABASE_URL: 'http://127.0.0.1:55439',
  VITE_HEXFORGE_SUPABASE_ANON_KEY: 'test-public-key',
  VITE_LOGGING_ENABLED: 'false',
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}

function start(script: string) {
  const child = spawn(process.execPath, [script], {
    env: environment, stdio: 'inherit', windowsHide: true,
  })
  children.add(child)
  child.on('error', () => stop(1))
  child.on('exit', (code) => {
    children.delete(child)
    if (!stopping) stop(code || 1)
  })
}

async function waitFor(url: string, timeout: number) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline && !stopping) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return
    } catch { /* The local server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`The local demo could not start at ${url}`)
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
process.on('exit', () => { for (const child of children) child.kill() })

try {
  start('tests/helpers/testServer.ts')
  await waitFor('http://127.0.0.1:55439/health', 30000)
  start('tests/helpers/browserSite.ts')
  await waitFor('http://127.0.0.1:5175/__demo', 180000)
  process.stdout.write('\nLocal demo ready: http://127.0.0.1:5175/__demo\n')
  process.stdout.write('Guest login: http://127.0.0.1:5175/login\n')
  process.stdout.write('Sample data only. Auth is simulated. Restarting clears the demo. Ctrl+C stops it.\n')
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Demo startup failed'}\n`)
  stop(1)
}
