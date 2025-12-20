import { AppBar, Toolbar, IconButton, Typography } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useTheme } from '@mui/material/styles'
import { useLayout } from './LayoutContext'

type Props = {
  title?: string
}

export default function Header({ title = 'Dashboard Overview' }: Props) {
  const theme = useTheme()
  const { open: finalOpen, onToggle: finalOnToggle, drawerWidth } = useLayout()

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
        ...(finalOpen && {
          marginLeft: drawerWidth,
          width: `calc(100% - ${drawerWidth}px)`,
        }),
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
            ...(finalOpen && { display: 'none' }),
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