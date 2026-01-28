import {
  Box,
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
import { useTheme } from '@mui/material/styles'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import logo from '../assets/logo.svg'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import PeopleIcon from '@mui/icons-material/People'
import BugReportIcon from '@mui/icons-material/BugReport'
import HelpIcon from '@mui/icons-material/Help'
import BuildIcon from '@mui/icons-material/Build'
import AssessmentIcon from '@mui/icons-material/Assessment'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLayout } from './LayoutContext'
import { useColorMode } from '../context/ThemeContext'

type User = {
  name: string
  avatarUrl?: string
  authorisation?: boolean
  analytics?: boolean
  settings?: boolean
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
  const theme = useTheme()
  const { toggleColorMode } = useColorMode()

  const handleLogout = () => {
    if (onSignOut) return onSignOut()
    navigate('/login')
  }

  const menuItems = [
    { label: 'Bookings', path: '/bookings', icon: <CalendarMonthIcon /> },
    { label: 'Analytics', path: '/report', icon: <AssessmentIcon />, protected: 'analytics' },
    { label: 'Manage Users', path: '/access', icon: <PeopleIcon />, protected: 'authorisation' },
    { label: 'Maintenance', path: '/maintenance', icon: <BuildIcon /> },
    { label: 'Report Bug', path: '/bug', icon: <BugReportIcon /> },
    { label: 'Help', path: '/document', icon: <HelpIcon /> },
    { label: 'Settings', path: '/settings', icon: <SettingsIcon />, protected: 'settings' },
  ]

  const filteredItems = menuItems.filter((item) => {
    if (item.protected) {
      // If currentUser is not yet loaded, hide protected items or show them?
      // Requirement: "if they don't have access to it... take away on the side panel"
      // So default to hidden if user not loaded or permission is false
      return currentUser?.[item.protected as keyof User] === true
    }
    return true
  })

  const DrawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', px: [2] }}>
        <Box sx={{ flexGrow: 1, display: 'flex' }}>
          <img
            src={logo}
            height = {100}
            width= 'auto'
            style={{
              filter: theme.palette.mode === 'dark' ? 'invert(1) brightness(1)' : 'none',
            }}
          />
        </Box>
        <IconButton onClick={onToggle}>
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>

      <Divider />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar 
          src={currentUser?.avatarUrl || undefined} 
          imgProps={{ referrerPolicy: 'no-referrer' }}
          sx={{ width: 40, height: 40, border: '2px solid' }} 
        />
        <Typography sx={{ fontWeight: 600, fontSize: '1rem' }} noWrap>
          {currentUser?.name ?? 'User'}
        </Typography>
      </Box>

      <Divider />

      <List sx={{ flexGrow: 1, pt: 2 }}>
        {filteredItems.map((item) => (
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

      <List>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton onClick={toggleColorMode} sx={{ px: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 3 }}>
              {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </ListItemIcon>
            <ListItemText primary={theme.palette.mode === 'dark' ? 'Light Mode' : 'Dark Mode'} />
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
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  )

  return (
    <SwipeableDrawer
      anchor="left"
      open={finalOpen}
      onClose={finalOnToggle}
      onOpen={finalOnToggle}
      disableDiscovery={false}
      swipeAreaWidth={20}
      PaperProps={{
        sx: {
          width: finalDrawerWidth,
          height: '100%',
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {DrawerContent}
    </SwipeableDrawer>
  )
}
