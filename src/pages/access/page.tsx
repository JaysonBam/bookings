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
  CircularProgress
} from '@mui/material'
import Header from '../../components/header'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import { useTheme } from '@mui/material/styles'
import { styles as makeStyles } from './styles'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Profile = {
  email: string
  full_name: string | null
  profile_url: string | null
  status: 'active' | 'pending'
  settings: boolean
  authorisation: boolean
  analytics: boolean
}

export default function AccessPage() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email')
      
      if (error) throw error
      setProfiles(data || [])
    } catch (error) {
      console.error('Error fetching profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  const handleToggle = async (email: string, field: 'settings' | 'authorisation' | 'analytics', currentValue: boolean) => {
    try {
      // Optimistic update
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
      // Revert on error
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
    } catch (error) {
      console.error('Error deleting user:', error)
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

      setOpenModal(false)
      setNewEmail('')
      fetchProfiles()
    } catch (err: any) {
      setAddError(err.message || 'Failed to add user')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Box sx={styles.root}>
      <Box sx={styles.header}>
        <Box>
            <Header title="User Management" />
          <Typography variant="body1" sx={styles.subtitle}>
            Manage user access and permissions for the application
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setOpenModal(true)}
        >
          Add User
        </Button>
      </Box>

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
            {loading ? (
               <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={30} />
                </TableCell>
               </TableRow>
            ) : profiles.map((profile) => (
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

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
      >
        <Box sx={styles.modalContent} component="form" onSubmit={handleAddUser}>
          <Typography variant="h6" sx={{ mb: 2 }}>Add New User</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter the email address of the user you want to grant access to.
          </Typography>
          
          <Stack spacing={2}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <TextField 
              label="Email Address" 
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
    </Box>
  )
}
