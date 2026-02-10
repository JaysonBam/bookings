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
  flex: 1, // Fill available vertical space in the flex parent
  minHeight: 0, // Ensure it shrinks
  overflow: 'auto',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
  },
  '&::-webkit-scrollbar-thumb': {
      backgroundColor: theme.palette.action.hover,
      borderRadius: '4px',
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
  zIndex: 11, // Higher than header? No, header is 10. Time column 11. Corner (0,0) needs 12.
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
  // Handling state visual cues if needed
  ...(state === 'Reserved' && {
      opacity: 0.7,
  }),
  ...(state === 'Ended' && {
    filter: 'grayscale(100%)',
    opacity: 0.5,
  }),
}));

export const StyledResizeHandle = styled(Box)(() => ({
  position: 'absolute',
  bottom: -5,
  left: 0,
  right: 0,
  height: 15,
  cursor: 'ns-resize',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0,
  transition: 'opacity 0.2s',
  '&:hover': { opacity: 1 },
  '&::after': {
    content: '""',
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 2,
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
}));

export const StyledQuickActionOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.1)',
  backdropFilter: 'blur(1px)',
  zIndex: 2,
  borderRadius: theme.shape.borderRadius,
}));

export const StyledPreviewBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isValid' && prop !== 'isStart' && prop !== 'isEnd' && prop !== 'color' && prop !== 'type',
})<{
  isValid: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  color?: string;
  type?: 'CREATE' | 'MOVE';
}>(({ theme, isValid, isStart, isEnd, color, type }) => ({
  position: 'absolute',
  inset: 0,
  backgroundColor: isValid
    ? type === 'CREATE'
      ? theme.palette.primary.main
      : color || theme.palette.info.main
    : theme.palette.error.main,
  opacity: isValid ? 0.8 : 0.6,
  borderTop: isStart ? '2px dashed rgba(255,255,255,0.5)' : 'none',
  borderBottom: isEnd ? '2px dashed rgba(255,255,255,0.5)' : 'none',
  borderLeft: '2px dashed rgba(255,255,255,0.5)',
  borderRight: '2px dashed rgba(255,255,255,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 5,
  pointerEvents: 'none',
}));

export const StyledIntersectionPreview = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'topPct' && prop !== 'heightPct' && prop !== 'isValid' && prop !== 'color' && prop !== 'type',
})<{
    topPct: number;
    heightPct: number;
    isValid: boolean;
    color?: string;
    type?: 'CREATE' | 'MOVE';
}>(({ theme, topPct, heightPct, isValid, color, type }) => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${topPct}%`,
    height: `${heightPct}%`,
    backgroundColor: isValid
      ? type === 'CREATE'
        ? theme.palette.primary.main
        : color || theme.palette.info.main
      : theme.palette.error.main,
    opacity: isValid ? 0.8 : 0.6,
    border: '2px dashed rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
}));

export const StyledStatusDot = styled(Box)<{ color: string }>(({ color }) => ({
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: color,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.2)',
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
    whiteSpace: 'nowrap', // Prevent content wrapping when closing
}));

export const StyledBookingPanelContents = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
}));

export const StyledHeaderContent = styled(Box)(() => ({
  display: 'flex', 
  flexDirection: 'column', 
  alignItems: 'center', 
  justifyContent: 'flex-end'
}));

export const StyledHeaderName = styled(Box)(() => ({
  fontWeight: 'bold'
}));

export const StyledHeaderMeta = styled(Box)(() => ({
  fontSize: '0.75rem', 
  fontWeight: 'normal', 
  marginTop: '2px', 
  minHeight: '1.2em', 
  display: 'flex', 
  gap: '4px', 
  justifyContent: 'center', 
  alignItems: 'center'
}));

export const StyledDynamicLabel = styled('span')(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  marginRight: '2px'
}));

export const StyledLabelBackground = styled('span')(() => ({
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: '#b0b3b8', 
  zIndex: 0,
}));

export const StyledLabelText = styled('span')(() => ({
  position: 'relative', 
  zIndex: 1, 
  color: '#222'
}));
