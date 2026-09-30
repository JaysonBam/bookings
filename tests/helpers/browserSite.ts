import { build, preview, type PreviewServer } from 'vite'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const digest = createHash('sha256')
function hashDirectory(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    const path = join(directory,entry.name)
    if (entry.isDirectory()) hashDirectory(path)
    else { digest.update(path); digest.update(readFileSync(path)) }
  }
}
hashDirectory('src')
for (const file of ['vite.config.ts','package-lock.json','index.html']) digest.update(readFileSync(file))
for (const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_HEXFORGE_SUPABASE_URL','VITE_HEXFORGE_SUPABASE_ANON_KEY']) {
  digest.update(process.env[key] || '')
}
const fingerprint = digest.digest('hex')
const port = Number(process.env.BOOKINGS_TEST_SITE_PORT || 5175)
const outDir = process.env.BOOKINGS_TEST_SITE_PORT ? join('.test-dist', `port-${port}`) : '.test-dist'
const marker = join(outDir, 'build-hash')
if (!existsSync(marker) || readFileSync(marker,'utf8') !== fingerprint || !existsSync(join(outDir, 'index.html'))) {
  await build({ build: { outDir } })
  writeFileSync(marker,fingerprint)
}
const server = await preview({ build: { outDir }, preview: {
  host: '127.0.0.1', port, strictPort: true,
}, plugins: process.env.BOOKINGS_LOCAL_DEMO === 'true' ? [{
  name: 'local-demo-bootstrap', configurePreviewServer: installDemoPage,
}] : [] })
function installDemoPage(server: PreviewServer) {
  // This route exists only in the local preview helper, never the app bundle.
  server.middlewares.use((request, response, next) => {
    if (request.url?.split('?')[0] !== '/__demo') { next(); return }
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Bookings local demo</title>
      <style>body{font:16px system-ui;color:#172033;background:#f1f5f9;margin:0;padding:24px}
      main{max-width:560px;margin:10vh auto;padding:28px;background:white;border-radius:12px}
      button{font:inherit;background:#172033;color:white;border:0;padding:12px 18px;border-radius:6px;cursor:pointer}
      a{color:#2563eb}p{line-height:1.6}</style><main>
      <h1>Bookings local demo</h1>
      <p>Use sample data to try temporary access codes. This demo uses simulated sign-in;
      your real Google account and production data are not used.</p>
      <button id="staff">Open as test Access Control staff</button>
      <p>Generate a code, then copy <strong>http://127.0.0.1:5175/login</strong>
      into an Incognito/private window or a different browser and enter that code.</p>
      <p><strong>Ordinary tabs share the same login.</strong> Signing in as test staff here
      also makes that staff login available to other ordinary tabs. Use a separate
      private window to test a temporary user while staff stays signed in.</p>
      <p>Return here to sign in as test staff again. Restarting the demo clears its data.</p>
      <p id="error" role="alert"></p></main><script>
      document.getElementById('staff').onclick = async () => {
        const button = document.getElementById('staff'); button.disabled = true;
        try {
          const response = await fetch('http://127.0.0.1:55439/__session', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({kind:'admin'})
          });
          if (!response.ok) throw new Error('The local test backend is unavailable.');
          localStorage.setItem('sb-127-auth-token', JSON.stringify(await response.json()));
          location.replace('/access');
        } catch (error) { document.getElementById('error').textContent = error.message; button.disabled = false; }
      };
      </script></html>`)
  })
}
process.stdout.write('Browser test site ready\n')
const stop = () => server.httpServer.close(() => process.exit(0))
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
