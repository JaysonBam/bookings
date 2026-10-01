/**
 * Purpose: Module logic for components\Sidebar.tsx.
 */
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
import { alpha, useTheme } from '@mui/material/styles'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import logo from '../assets/logo.svg'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import Inventory2Icon from '@mui/icons-material/Inventory2'
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
    { label: '3D Print Collection', path: '/collections', icon: <Inventory2Icon /> },
    { label: 'Analytics', path: '/report', icon: <AssessmentIcon />, protected: 'analytics' },
    { label: 'Manage Users', path: '/access', icon: <PeopleIcon />, protected: 'authorisation' },
    { label: 'Maintenance', path: '/maintenance', icon: <BuildIcon /> },
    { label: 'Report Bug', path: '/bug', icon: <BugReportIcon /> },
    { label: 'Help', path: '/document', icon: <HelpIcon /> },
    { label: 'Settings', path: '/settings', icon: <SettingsIcon />, protected: 'settings' },
  ]

  const filteredItems = menuItems.filter((item) => {
    if (item.protected) {
      return currentUser?.[item.protected as keyof User] === true
    }
    return true
  })

  const DrawerContent = (
    <Box sx={{ minHeight: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', direction: 'ltr' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', px: [2] }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
          <img
            src={logo}
            alt="Bookings logo"
            style={{
              width: '100%', height: 100, objectFit: 'contain',
              filter: theme.palette.mode === 'dark' ? 'invert(1) brightness(1)' : 'none',
            }}
          />
        </Box>
        <IconButton onClick={onToggle} aria-label="Close menu" sx={{ flexShrink: 0 }}>
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>

      <Divider />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar 
          src={currentUser?.avatarUrl || undefined} 
          imgProps={{ referrerPolicy: 'no-referrer' }}
          sx={{ width: 40, height: 40, border: '2px solid', flexShrink: 0 }}
        />
        <Typography sx={{ fontWeight: 600, fontSize: '1rem', minWidth: 0 }} noWrap>
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
          maxWidth: '100%',
          height: '100%',
          overflowX: 'hidden',
          // Keep the scrollbar at the outside edge; content stays left-to-right.
          direction: 'rtl',
          '@supports not selector(::-webkit-scrollbar)': {
            scrollbarWidth: 'thin',
            scrollbarColor: `${alpha(theme.palette.text.secondary, 0.45)} transparent`,
          },
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-button': { display: 'none' },
          '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.text.secondary, 0.45),
            borderRadius: 8,
          },
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
