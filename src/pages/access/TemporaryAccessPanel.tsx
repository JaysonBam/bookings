import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material'
import {
  createTemporaryAccessCode, listTemporaryAccessCodes, revokeTemporaryAccessCode,
  type TemporaryAccessCode,
} from '../../api/supabase/temporaryAccess'

export default function TemporaryAccessPanel() {
  const [codes, setCodes] = useState<TemporaryAccessCode[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const [hours, setHours] = useState(24)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<{ code: string; label: string } | null>(null)
  const [removing, setRemoving] = useState<TemporaryAccessCode | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try { setCodes(await listTemporaryAccessCodes()) }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to load access codes.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Paper variant="outlined" sx={{ mt: 4, p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Temporary access</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Codes work until expiry or removal. Each code has one user ID, even when used on multiple devices.
        Temporary users can use bookings, maintenance and bug reporting.
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const result = await createTemporaryAccessCode(label.trim(), hours)
          setGenerated({ code: result.code, label: label.trim() })
          setCopied(false)
          setLabel('')
          await load()
        } catch (error) { setError(error instanceof Error ? error.message : 'Unable to generate access code.') }
        finally { setBusy(false) }
      }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
          <TextField label="Temporary user name" required fullWidth value={label}
            onChange={(event) => setLabel(event.target.value)} disabled={busy}
            inputProps={{ maxLength: 80 }} sx={{ flex: 1 }} />
          <TextField label="Valid for" select value={hours} disabled={busy}
            onChange={(event) => setHours(Number(event.target.value))} sx={{ minWidth: 150 }}>
            <MenuItem value={1}>1 hour</MenuItem>
            <MenuItem value={8}>8 hours</MenuItem>
            <MenuItem value={24}>24 hours</MenuItem>
            <MenuItem value={168}>7 days</MenuItem>
          </TextField>
          <Button variant="contained" type="submit" disabled={busy || !label.trim()} sx={{ minHeight: 56, whiteSpace: 'nowrap' }}>
            {busy ? 'Working…' : 'Generate code'}
          </Button>
        </Stack>
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3, mb: 1 }}>
        <Typography variant="subtitle2">Recent access codes</Typography>
        <Button size="small" onClick={() => { setError(null); void load() }} disabled={loading || busy}>Refresh codes</Button>
      </Stack>
      {loading ? <CircularProgress size={24} aria-label="Loading access codes" /> : (
        <Stack spacing={1}>
          {codes.map((code) => {
            const status = code.revoked_at ? 'Removed' : Date.parse(code.expires_at) <= now ? 'Expired' : 'Active'
            return (
              <Stack key={code.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600}>{code.label}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Expires {new Date(code.expires_at).toLocaleString()} · {code.login_count} logins
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    User ID: {code.user_id}
                  </Typography>
                </Box>
                <Chip size="small" label={status} color={status === 'Active' ? 'success' : 'default'} />
                {!code.revoked_at && <Button color="error" disabled={busy} onClick={() => setRemoving(code)}>Remove</Button>}
              </Stack>
            )
          })}
          {codes.length === 0 && <Typography color="text.secondary">No temporary access codes yet.</Typography>}
        </Stack>
      )}
      <Dialog open={Boolean(generated)} onClose={() => setGenerated(null)} fullWidth maxWidth="sm">
        <DialogTitle>Access code for {generated?.label}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Copy this code now. It will not be shown again after you close this window.</Alert>
          <TextField label="Generated access code" fullWidth value={generated?.code || ''}
            InputProps={{ readOnly: true }}
            sx={{ '& input': { fontFamily: 'monospace', fontSize: { xs: '0.8rem', sm: '1rem' } } }}
            onFocus={(event) => event.target.select()} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Use this code on the login page. Keep it private. Collections and administrator tools are unavailable.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => {
            try { await navigator.clipboard.writeText(generated?.code || ''); setCopied(true) }
            catch { setCopied(false) }
          }}>{copied ? 'Copied' : 'Copy code'}</Button>
          <Button onClick={() => setGenerated(null)}>Done</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(removing)} onClose={() => { if (!busy) setRemoving(null) }}>
        <DialogTitle>Remove temporary access?</DialogTitle>
        <DialogContent>Access for {removing?.label} will stop on all devices. The code cannot be used again.</DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setRemoving(null)}>Cancel</Button>
          <Button color="error" disabled={busy} onClick={async () => {
            if (!removing) return
            setBusy(true)
            setError(null)
            try { await revokeTemporaryAccessCode(removing.id); setRemoving(null); await load() }
            catch (error) { setError(error instanceof Error ? error.message : 'Unable to remove access code.') }
            finally { setBusy(false) }
          }}>Remove access</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
