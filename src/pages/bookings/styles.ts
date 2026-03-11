/**
 * Purpose: Module logic for pages\bookings\styles.ts.
 */
import { styled } from '@mui/material/styles';
import { TableCell, TableContainer, Box, Paper, Toolbar } from '@mui/material';

export const StyledPageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  backgroundColor: theme.palette.background.default,
  overflow: 'hidden',
}));

export const StyledContentContainer = styled(Box)(() => ({
  display: 'flex',
  flex: 1,
  minHeight: 0, 
  overflow: 'hidden',
  position: 'relative',
}));

export const StyledGridContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  padding: theme.spacing(1),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

export const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  flex: 1,
  minHeight: 0, // Ensure it shrinks
  overflow: 'auto',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '&::-webkit-scrollbar': {
      width: '12px',
      height: '32px',
  },
  '&::-webkit-scrollbar-thumb': {
      backgroundColor: theme.palette.action.hover,
      backgroundClip: 'content-box',
  },
  '&::-webkit-scrollbar-thumb:horizontal': {
      borderRadius: '16px',
      border: '4px solid transparent',
  },
  '&::-webkit-scrollbar-thumb:vertical': {
      borderRadius: '6px',
      border: '2px solid transparent',
  },
}));

export const StyledHeaderCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper, 
  position: 'sticky',
  top: 0,
  zIndex: 10,
  borderBottom: `1px solid ${theme.palette.divider}`,
  fontWeight: 'bold',
  textAlign: 'center',
  padding: theme.spacing(1),
  minWidth: '60px',
}));

export const StyledTimeCell = styled(TableCell)(({ theme }) => ({
  position: 'sticky',
  left: 0,
  backgroundColor: theme.palette.background.paper,
  zIndex: 11,
  borderRight: `1px solid ${theme.palette.divider}`,
  fontWeight: 'bold',
  textAlign: 'center',
  padding: theme.spacing(1),
  width: '50px',
}));

export const StyledCornerCell = styled(TableCell)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  left: 0,
  zIndex: 12,
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  borderRight: `1px solid ${theme.palette.divider}`,
}));

export const StyledBookingCell = styled(TableCell, {
    shouldForwardProp: (prop) => prop !== 'bgColor' && prop !== 'textColor' && prop !== 'isHighlighted' && prop !== 'state',
})<{ 
    bgColor?: string; 
    textColor?: string; 
    isHighlighted?: boolean;
    state?: string;
}>(({ theme, bgColor, textColor, isHighlighted, state }) => ({
  padding: theme.spacing(0.5),
  cursor: 'pointer',
  position: 'relative',
  backgroundColor: bgColor || 'inherit',
  color: textColor || 'inherit',
  border: `1px solid ${theme.palette.divider}`,
  height: '30px', // Example height
  '&:hover': {
      filter: 'brightness(0.9)',
  },
  ...(isHighlighted && {
      border: `2px solid ${theme.palette.primary.main}`,
      zIndex: 5,
  }),
  ...(state === 'Reserved' && {
      opacity: 0.7,
  }),
  ...(state === 'Ended' && {
    filter: 'grayscale(100%)',
    opacity: 0.5,
  }),
}));

export const StyledToolbar = styled(Toolbar)(({ theme }) => ({
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2),
    minHeight: '64px',
}));

export const StyledSearchPanel = styled(Paper, {
    shouldForwardProp: (prop) => prop !== 'isOpen',
})<{ isOpen: boolean }>(({ theme, isOpen }) => ({
    width: isOpen ? '320px' : '0px',
    transition: 'width 0.3s ease',
    borderLeft: isOpen ? `1px solid ${theme.palette.divider}` : 'none',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    whiteSpace: 'nowrap',
}));

export const StyledBookingPanelContents = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
}));
