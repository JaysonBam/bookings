import { AppBar, Toolbar, IconButton, Typography } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useTheme } from '@mui/material/styles'
import { useLayout } from './LayoutContext'

type Props = {
  open?: boolean
  isMobile?: boolean
  drawerWidth?: number
  onToggle?: () => void
  title?: string
}

export default function Header({ open, isMobile, drawerWidth = 280, onToggle, title = 'Dashboard Overview' }: Props) {
  const theme = useTheme()
  let ctxOpen = open
  let ctxIsMobile = isMobile
  let ctxOnToggle = onToggle

  let layout: any | undefined
  try {
    layout = useLayout()
  } catch (e) {
    layout = undefined
  }

  if (layout) {
    if (open === undefined) ctxOpen = layout.open
    if (isMobile === undefined) ctxIsMobile = layout.isMobile
    if (onToggle === undefined) ctxOnToggle = layout.onToggle
  }

  const finalOpen = ctxOpen ?? false
  const finalIsMobile = ctxIsMobile ?? false
  const finalOnToggle = ctxOnToggle ?? (() => {})

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
        ...(finalOpen && !finalIsMobile && {
          marginLeft: drawerWidth,
          width: `calc(100% - ${drawerWidth}px)`,
        }),
        // Remove custom colors, use MUI default theme
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={finalOnToggle}
          edge="start"
          sx={{
            marginRight: 2,
            ...(finalOpen && !finalIsMobile && { display: 'none' }),
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