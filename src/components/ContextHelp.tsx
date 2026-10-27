import { useState } from 'react';
import { Box, Button, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';

interface ContextHelpProps {
  id: string;
  label: string;
  description: string;
}

/** The same guidance is available to assistive tools, hover, keyboard and touch. */
export function ContextHelp({ id, label, description }: ContextHelpProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <span id={id} hidden>{description}</span>
    <Tooltip title={description} describeChild open={tipOpen && !anchor}
      onOpen={() => setTipOpen(true)} onClose={() => setTipOpen(false)}>
      <IconButton size="small" aria-label={label} aria-describedby={id} aria-haspopup="dialog"
        aria-expanded={!!anchor} aria-controls={anchor ? `${id}-popover` : undefined}
        sx={{ ml: 0.5, color: 'text.secondary', verticalAlign: 'middle' }}
        onClick={event => { setTipOpen(false); setAnchor(event.currentTarget); }}>
        <HelpOutlineIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      PaperProps={{ id: `${id}-popover`, role: 'dialog', 'aria-label': label, sx: { p: 2, width: 360, maxWidth: 'calc(100vw - 32px)' } }}>
      <Typography variant="subtitle2" gutterBottom>{label}</Typography>
      <Typography variant="body2">{description}</Typography>
      <Box display="flex" justifyContent="flex-end" mt={1}>
        <Button size="small" autoFocus onClick={() => setAnchor(null)}>Close help</Button>
      </Box>
    </Popover>
  </>;
}
