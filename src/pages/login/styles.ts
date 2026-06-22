/**
 * Purpose: Module logic for pages\login\styles.ts.
 */
import loginBg from '../../assets/login-bg.svg'

export const styles = (theme: any) => ({
  root: {
    position: 'fixed',
    inset: 0,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'background.default',
    p: { xs: 1, sm: 3 },
    overflow: 'hidden',
  },
  container: { width: '100%', position: 'relative', zIndex: 1 },
  paper: {
    p: { xs: 2, sm: 6 },
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderColor: 'divider',
    borderWidth: 1,
    borderStyle: 'solid',
    boxShadow: 1,
    textAlign: 'center',
    width: '100%',
    maxWidth: { xs: 'calc(100% - 32px)', sm: 520, md: 420 },
    mx: 'auto',
    maxHeight: '100%',
    overflowY: 'auto',
  },
  stack: { width: '100%' },
  titleBox: { width: '100%' },
  title: { mb: 0.5 },
  subtitle: { mb: 2 },
  disclosure: {
    mb: 2,
    mx: 'auto',
    maxWidth: 360,
    lineHeight: 1.55,
  },
  legalLinks: {
    display: 'block',
    mt: 2,
    lineHeight: 1.6,
  },
  googleBtn: {
    py: 1.5,
    textTransform: 'none',
    fontSize: '1rem',
    fontWeight: 500,
    borderColor: 'divider',
    color: 'text.primary',
    backgroundColor: 'background.paper',
    '&:hover': { backgroundColor: 'action.hover', borderColor: 'divider' },
    transition: 'all 0.2s ease-in-out',
  },
  logo: { height: 96, mb: 1 },
  background: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    backgroundImage: `url(${loginBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: theme.palette.mode === 'dark' ? 'blur(6px) brightness(0.75)' : 'blur(6px)',
    transform: 'scale(1.03)'
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'transparent',
    pointerEvents: 'none'
  }
})
