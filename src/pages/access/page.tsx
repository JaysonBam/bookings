/**
 * Purpose: Module logic for pages\access\page.tsx.
 */
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Avatar, 
  Chip, 
  Switch, 
  IconButton, 
  Button, 
  Tooltip,
  TextField,
  Modal,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  useMediaQuery,
  Card,
  CardContent,
  CardActions,
  Divider
} from '@mui/material'
import Header from '../../components/header'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import { useTheme } from '@mui/material/styles'
import { styles as makeStyles } from './styles'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  addHexForgeProfile,
  deleteHexForgeProfile,
  fetchHexForgeProfiles as fetchHexForgeProfilesFromApi,
  type HexForgeProfile
} from '../../lib/hexForgeAccessClient'

type Profile = {
  email: string
  full_name: string | null
  profile_url: string | null
  status: 'active' | 'pending'
  settings: boolean
  authorisation: boolean
  analytics: boolean
}

type PermissionField = 'settings' | 'authorisation' | 'analytics'

const permissionFields: PermissionField[] = ['settings', 'analytics', 'authorisation']

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export default function AccessPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const styles = makeStyles(theme)
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [hexForgeProfiles, setHexForgeProfiles] = useState<HexForgeProfile[]>([])
  const [hexForgeLoading, setHexForgeLoading] = useState(true)
  const [openHexForgeModal, setOpenHexForgeModal] = useState(false)
  const [newHexForgeEmail, setNewHexForgeEmail] = useState('')
  const [hexForgeAddError, setHexForgeAddError] = useState<string | null>(null)
  const [hexForgeAdding, setHexForgeAdding] = useState(false)

  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
      setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email')
      
      if (error) throw error
      setProfiles(data || [])
    } catch (error) {
      console.error('Error fetching profiles:', error)
      showToast('Failed to load user profiles', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const fetchHexForgeProfiles = useCallback(async () => {
    try {
      setHexForgeLoading(true)
      const profiles = await fetchHexForgeProfilesFromApi()
      setHexForgeProfiles(profiles || [])
    } catch (error) {
      console.error('Error fetching HexForge profiles:', error)
      showToast('Failed to load 3D printing access list', 'error')
    } finally {
      setHexForgeLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchProfiles()
    fetchHexForgeProfiles()
  }, [fetchProfiles, fetchHexForgeProfiles])

  const handleToggle = async (email: string, field: 'settings' | 'authorisation' | 'analytics', currentValue: boolean) => {
    try {
      setProfiles(prev => prev.map(p => 
        p.email === email ? { ...p, [field]: !currentValue } : p
      ))

      const { error } = await supabase
        .from('profiles')
        .update({ [field]: !currentValue })
        .eq('email', email)

      if (error) throw error
    } catch (error) {
      console.error('Error updating permission:', error)
      showToast('Failed to update permission', 'error')
      fetchProfiles()
    }
  }

  const handleDelete = async (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email}?`)) return

    try {
      setProfiles(prev => prev.filter(p => p.email !== email))
      
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('email', email)

      if (error) throw error
      showToast('User removed successfully', 'success')
    } catch (error) {
      console.error('Error deleting user:', error)
      showToast('Failed to delete user', 'error')
      fetchProfiles()
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    setAdding(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{ email: newEmail, status: 'pending' }])

      if (error) {
        if (error.code === '23505') throw new Error('User already exists')
        throw error
      }

      showToast('User added successfully', 'success')
      setNewEmail('')
      fetchProfiles()
    } catch (err) {
      setAddError(getErrorMessage(err, 'Failed to add user'))
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteHexForgeUser = async (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from 3D printing access?`)) return

    try {
      setHexForgeProfiles(prev => prev.filter(p => p.email !== email))
      await deleteHexForgeProfile(email)
      showToast('3D printing user removed successfully', 'success')
    } catch (error) {
      console.error('Error deleting HexForge user:', error)
      showToast('Failed to remove 3D printing user', 'error')
      fetchHexForgeProfiles()
    }
  }

  const handleAddHexForgeUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setHexForgeAddError(null)
    setHexForgeAdding(true)

    try {
      await addHexForgeProfile(newHexForgeEmail)
      showToast('3D printing user added successfully', 'success')
      setNewHexForgeEmail('')
      setOpenHexForgeModal(false)
      fetchHexForgeProfiles()
    } catch (err) {
      setHexForgeAddError(getErrorMessage(err, 'Failed to add 3D printing user'))
    } finally {
      setHexForgeAdding(false)
    }
  }

  const renderMobileView = () => (
    <Stack spacing={2}>
      {profiles.map((profile) => (
        <Card key={profile.email} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Avatar 
                    src={profile.profile_url || undefined} 
                    alt={profile.full_name || ''} 
                    imgProps={{ referrerPolicy: 'no-referrer' }}
                >
                {(profile.full_name || profile.email)[0].toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                        {profile.full_name || 'Unknown Name'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {profile.email}
                    </Typography>
                </Box>
                <Chip 
                    label={profile.status} 
                    size="small" 
                    color={profile.status === 'active' ? 'success' : 'default'}
                    variant={profile.status === 'active' ? 'filled' : 'outlined'}
                />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
                {permissionFields.map((permission) => (
                    <Box key={permission} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {permission === 'authorisation' ? 'Access' : permission}
                        </Typography>
                        <Switch 
                            size="small"
                            checked={profile[permission]}
                            onChange={() => handleToggle(profile.email, permission, profile[permission])}
                        />
                    </Box>
                ))}
            </Stack>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 2, px: 2 }}>
            <Button 
                size="small" 
                color="error" 
                startIcon={<DeleteIcon />}
                onClick={() => handleDelete(profile.email)}
            >
                Remove User
            </Button>
          </CardActions>
        </Card>
      ))}
      {profiles.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No users found
          </Typography>
      )}
    </Stack>
  )

  const renderDesktopView = () => (
    <TableContainer component={Paper} elevation={0} sx={styles.tableContainer}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Settings</TableCell>
              <TableCell align="center">Analytics</TableCell>
              <TableCell align="center">Access</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.email} hover>
                <TableCell>
                  <Box sx={styles.userCell}>
                    {profile.status === 'active' ? (
                       <>
                         <Avatar 
                           src={profile.profile_url || undefined} 
                           alt={profile.full_name || ''} 
                           imgProps={{ referrerPolicy: 'no-referrer' }}
                           sx={styles.avatar}
                         >
                            {(profile.full_name || profile.email)[0].toUpperCase()}
                         </Avatar>
                         <Box>
                           <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                             {profile.full_name || 'Unknown Name'}
                           </Typography>
                           <Typography variant="caption" color="text.secondary">
                             {profile.email}
                           </Typography>
                         </Box>
                       </>
                    ) : (
                        <>
                        <Avatar sx={styles.avatar}>?</Avatar>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', fontStyle: 'italic' }}>
                                Pending Registration
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {profile.email}
                            </Typography>
                        </Box>
                        </>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={profile.status} 
                    size="small" 
                    color={profile.status === 'active' ? 'success' : 'default'}
                    variant={profile.status === 'active' ? 'filled' : 'outlined'}
                    sx={styles.statusChip}
                  />
                </TableCell>
                <TableCell align="center">
                  <Switch 
                    size="small"
                    checked={profile.settings} 
                    onChange={() => handleToggle(profile.email, 'settings', profile.settings)}
                    sx={styles.permissionToggle}
                  />
                </TableCell>
                <TableCell align="center">
                  <Switch 
                    size="small"
                    checked={profile.analytics} 
                    onChange={() => handleToggle(profile.email, 'analytics', profile.analytics)}
                    sx={styles.permissionToggle}
                  />
                </TableCell>
                <TableCell align="center">
                  <Switch 
                    size="small"
                    checked={profile.authorisation} 
                    onChange={() => handleToggle(profile.email, 'authorisation', profile.authorisation)}
                    sx={styles.permissionToggle}
                  />
                </TableCell>
                <TableCell align="right">
                    <Tooltip title="Delete user">
                        <IconButton 
                            color="error" 
                            size="small" 
                            onClick={() => handleDelete(profile.email)}
                            sx={styles.actionButton}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!loading && profiles.length === 0 && (
                <TableRow>
                     <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                         <Typography color="text.secondary">No users found</Typography>
                     </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
  )

  const renderHexForgeMobileView = () => (
    <Stack spacing={2}>
      {hexForgeProfiles.map((profile) => (
        <Card key={profile.email} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={profile.profile_url || undefined}
                alt={profile.full_name || ''}
                imgProps={{ referrerPolicy: 'no-referrer' }}
              >
                {(profile.full_name || profile.email)[0].toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                  {profile.full_name || (profile.status === 'active' ? 'Unknown Name' : 'Pending Registration')}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {profile.email}
                </Typography>
              </Box>
              <Chip
                label={profile.status}
                size="small"
                color={profile.status === 'active' ? 'success' : 'default'}
                variant={profile.status === 'active' ? 'filled' : 'outlined'}
              />
            </Box>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 2, px: 2 }}>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => handleDeleteHexForgeUser(profile.email)}
            >
              Remove User
            </Button>
          </CardActions>
        </Card>
      ))}
      {hexForgeProfiles.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No 3D printing users found
        </Typography>
      )}
    </Stack>
  )

  const renderHexForgeDesktopView = () => (
    <TableContainer component={Paper} elevation={0} sx={styles.tableContainer}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {hexForgeProfiles.map((profile) => (
            <TableRow key={profile.email} hover>
              <TableCell>
                <Box sx={styles.userCell}>
                  {profile.status === 'active' ? (
                    <>
                      <Avatar
                        src={profile.profile_url || undefined}
                        alt={profile.full_name || ''}
                        imgProps={{ referrerPolicy: 'no-referrer' }}
                        sx={styles.avatar}
                      >
                        {(profile.full_name || profile.email)[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {profile.full_name || 'Unknown Name'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {profile.email}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Avatar sx={styles.avatar}>?</Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', fontStyle: 'italic' }}>
                          Pending Registration
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {profile.email}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={profile.status}
                  size="small"
                  color={profile.status === 'active' ? 'success' : 'default'}
                  variant={profile.status === 'active' ? 'filled' : 'outlined'}
                  sx={styles.statusChip}
                />
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Delete 3D printing user">
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => handleDeleteHexForgeUser(profile.email)}
                    sx={styles.actionButton}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {!hexForgeLoading && hexForgeProfiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                <Typography color="text.secondary">No 3D printing users found</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )

  return (
    <Box sx={styles.root}>
      <Header title="User Management" />

      <Box sx={{ mb: 4, mt: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between">
            <Box sx={{ maxWidth: '800px' }}>
                <Typography variant="body1" sx={{ color: 'text.primary', mb: 1 }}>
                    All users have <strong>viewer access</strong> to Bookings, Management, Bugs, and Documentation by default.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                   Use the table below to toggle advanced administration privileges.
                </Typography>
            </Box>
             <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => setOpenModal(true)}
                fullWidth={isMobile}
                sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
                Add User
            </Button>
        </Stack>

        <Paper 
            variant="outlined" 
            sx={{ 
                mt: 3, 
                p: 2, 
                bgcolor: 'background.default',
                borderRadius: 2
            }}
        >
            <Stack 
                direction={{ xs: 'column', md: 'row' }} 
                spacing={{ xs: 3, md: 2 }}
                divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />}
            >
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 0.5, letterSpacing: 0.5 }}>ACCESS</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>User Management</Typography>
                    <Typography variant="caption" color="text.secondary">Manage system administrators and user permissions.</Typography>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 0.5, letterSpacing: 0.5 }}>SETTINGS</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>System Configuration</Typography>
                    <Typography variant="caption" color="text.secondary">Modify global settings, room configurations, and course details.</Typography>
                </Box>

                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 0.5, letterSpacing: 0.5 }}>ANALYTICS</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Data Insights</Typography>
                    <Typography variant="caption" color="text.secondary">View usage statistics and download reports.</Typography>
                </Box>
            </Stack>
        </Paper>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
        </Box>
      ) : isMobile ? renderMobileView() : renderDesktopView()}

      <Box sx={{ mt: 5, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ maxWidth: '800px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              3D Printing / HexForge Access
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage the HexForge allow-list for MISC 3D printing staff access.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenHexForgeModal(true)}
            fullWidth={isMobile}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
          >
            Add 3D Printing User
          </Button>
        </Stack>
      </Box>

      {hexForgeLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : isMobile ? renderHexForgeMobileView() : renderHexForgeDesktopView()}

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
        </Alert>
      </Snackbar>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
      >
        <Box sx={styles.modalContent} component="form" onSubmit={handleAddUser}>
          <Typography variant="h6" sx={{ mb: 2 }}>Add New User</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please enter the user's primary Google account (Gmail address).
            <br />
            <strong>Note:</strong> Ensure it is the actual email address (e.g., <code>u12345678@tuks.co.za</code>) and not an alias (like <code>john.smith@tuks.co.za</code>).
          </Typography>
          
          <Stack spacing={2}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <TextField 
              label="Gmail Address" 
              type="email" 
              fullWidth 
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button onClick={() => setOpenModal(false)} disabled={adding}>Cancel</Button>
                <Button variant="contained" type="submit" disabled={adding}>
                    {adding ? 'Adding...' : 'Add User'}
                </Button>
            </Box>
          </Stack>
        </Box>
      </Modal>

      <Modal
        open={openHexForgeModal}
        onClose={() => setOpenHexForgeModal(false)}
      >
        <Box sx={styles.modalContent} component="form" onSubmit={handleAddHexForgeUser}>
          <Typography variant="h6" sx={{ mb: 2 }}>Add 3D Printing User</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter the user's primary Google account to allow access to HexForge.
            <br />
            <strong>Note:</strong> This creates a pending 3D printing profile that becomes active when the user signs in.
          </Typography>

          <Stack spacing={2}>
            {hexForgeAddError && <Alert severity="error">{hexForgeAddError}</Alert>}
            <TextField
              label="Gmail Address"
              type="email"
              fullWidth
              required
              value={newHexForgeEmail}
              onChange={(e) => setNewHexForgeEmail(e.target.value)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={() => setOpenHexForgeModal(false)} disabled={hexForgeAdding}>Cancel</Button>
              <Button variant="contained" type="submit" disabled={hexForgeAdding}>
                {hexForgeAdding ? 'Adding...' : 'Add User'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Modal>
    </Box>
  )
}
