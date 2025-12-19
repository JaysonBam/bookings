import {
  Box,
  Drawer,
  Toolbar,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
  IconButton,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import DashboardIcon from '@mui/icons-material/Dashboard'
import LogoutIcon from '@mui/icons-material/Logout'

type User = {
  name: string
  avatarUrl?: string
}

type Props = {
  open: boolean
  mobileOpen: boolean
  isMobile: boolean
  drawerWidth?: number
  currentUser?: User
  onToggle: () => void
  onSignOut?: () => void
}

export default function Sidebar({
  open,
  mobileOpen,
  isMobile,
  drawerWidth = 280,
  currentUser,
  onToggle,
  onSignOut,
}: Props) {
  

  const handleLogout = () => {
    if (onSignOut) return onSignOut()
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  const DrawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', px: [2] }}>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, color: 'primary.main' }}>
          BRAND
        </Typography>
        <IconButton onClick={onToggle}>
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>

      <Divider />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar src={currentUser?.avatarUrl} sx={{ width: 40, height: 40, border: '2px solid', borderColor: 'primary.main' }} />
        <Typography sx={{ fontWeight: 600, fontSize: '1rem' }} noWrap>
          {currentUser?.name ?? 'User'}
        </Typography>
      </Box>

      <Divider />

      <List sx={{ flexGrow: 1, pt: 2 }}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton selected sx={{ px: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 3, color: 'primary.main' }}>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>
      </List>

      <Divider />

      <List>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton onClick={handleLogout} sx={{ px: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 3 }}>
              <LogoutIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="Sign Out" primaryTypographyProps={{ color: 'error' }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  )

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      open={isMobile ? mobileOpen : open}
      onClose={onToggle}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {DrawerContent}
    </Drawer>
  )
}
