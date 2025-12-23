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
import KeyIcon from '@mui/icons-material/VpnKey'
import BugReportIcon from '@mui/icons-material/BugReport'
import DescriptionIcon from '@mui/icons-material/Description'
import BuildIcon from '@mui/icons-material/Build'
import AssessmentIcon from '@mui/icons-material/Assessment'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLayout } from './LayoutContext'

type User = {
  name: string
  avatarUrl?: string
}

type Props = {
  open: boolean
  drawerWidth?: number
  currentUser?: User
  onToggle: () => void
  onSignOut?: () => void
}

export default function Sidebar({
  open,
  drawerWidth = 280,
  currentUser,
  onToggle,
  onSignOut,
}: Props) {
  const layout = useLayout()
  const finalOpen = open === undefined ? layout.open : open
  const finalDrawerWidth = drawerWidth === undefined ? layout.drawerWidth : drawerWidth
  const finalOnToggle = onToggle ?? layout.onToggle

  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    if (onSignOut) return onSignOut()
    navigate('/login')
  }

  const DrawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', px: [2] }}>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          BRAND
        </Typography>
        <IconButton onClick={onToggle}>
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>

      <Divider />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar src={currentUser?.avatarUrl} sx={{ width: 40, height: 40, border: '2px solid' }} />
        <Typography sx={{ fontWeight: 600, fontSize: '1rem' }} noWrap>
          {currentUser?.name ?? 'User'}
        </Typography>
      </Box>

      <Divider />

      <List sx={{ flexGrow: 1, pt: 2 }}>
        {[
          { label: 'Bookings', path: '/bookings', icon: <DashboardIcon /> },
          { label: 'Access', path: '/access', icon: <KeyIcon /> },
          { label: 'Bug', path: '/bug', icon: <BugReportIcon /> },
          { label: 'Document', path: '/document', icon: <DescriptionIcon /> },
          { label: 'Maintenance', path: '/maintenance', icon: <BuildIcon /> },
          { label: 'Report', path: '/report', icon: <AssessmentIcon /> },
          { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
        ].map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
            <ListItemButton selected={location.pathname === item.path} onClick={() => navigate(item.path)} sx={{ px: 2.5 }}>
              <ListItemIcon sx={{ minWidth: 0, mr: 3 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      <List>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton onClick={handleLogout} sx={{ px: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 3 }}>
              <LogoutIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  )

  return (
    <Drawer
      variant="persistent"
      open={finalOpen}
      onClose={finalOnToggle}
      sx={{
        width: finalDrawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: finalDrawerWidth,
          height: '100%',
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
