import { AppBar, Toolbar, IconButton, Typography } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useTheme } from '@mui/material/styles'

type Props = {
  open: boolean
  isMobile: boolean
  drawerWidth?: number
  onToggle: () => void
  title?: string
}

export default function Header({ open, isMobile, drawerWidth = 280, onToggle, title = 'Dashboard Overview' }: Props) {
  const theme = useTheme()

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        ...(open && !isMobile && {
          marginLeft: drawerWidth,
          width: `calc(100% - ${drawerWidth}px)`,
        }),
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={onToggle}
          edge="start"
          sx={{
            marginRight: 2,
            ...(open && !isMobile && { display: 'none' }),
          }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {title}
        </Typography>
      </Toolbar>
    </AppBar>
  )
}