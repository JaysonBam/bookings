/**
 * Purpose: Module logic for pages\access\styles.ts.
 */
import { Theme } from '@mui/material/styles';

export const styles = (theme: Theme) => ({
  root: {
    padding: theme.spacing(3),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  header: {
    marginBottom: theme.spacing(4),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
  },
  title: {
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
  },
  tableContainer: {
    marginTop: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      marginTop: theme.spacing(2),
    },
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 0.5,
    background: 'radial-gradient(circle at 15% 50%, rgba(255, 255, 255, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(255, 255, 255, 0.08), transparent 25%)',
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  avatar: {
    width: 40,
    height: 40,
    border: `2px solid ${theme.palette.background.paper}`,
    boxShadow: theme.shadows[1],
  },
  statusChip: {
    fontWeight: 600,
    fontSize: '0.75rem',
  },
  actionButton: {
    marginLeft: theme.spacing(1),
  },
  permissionToggle: {
    '& .MuiSwitch-switchBase.Mui-checked': {
      color: theme.palette.primary.main,
    },
  },
  modalContent: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    maxWidth: '90%',
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
    outline: 'none',
  },
});
