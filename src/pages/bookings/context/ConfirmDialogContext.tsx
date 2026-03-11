/**
 * Purpose: Module logic for pages\bookings\context\ConfirmDialogContext.tsx.
 */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface ConfirmAction {
    label: string;
    value: any;
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    variant?: 'text' | 'outlined' | 'contained';
}

interface ConfirmOptions {
    title?: string;
    description?: string;
    warning?: string;
    confirmText?: string;
    cancelText?: string;
    actions?: ConfirmAction[]; 
}

interface ConfirmDialogContextType {
    confirm: (options: ConfirmOptions) => Promise<any>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType>({
    confirm: async () => false,
});

export const ConfirmDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({});
    const [resolver, setResolver] = useState<(value: any) => void>(() => {});

    const confirm = (opts: ConfirmOptions) => {
        setOptions(opts);
        setOpen(true);
        return new Promise<any>((resolve) => {
            setResolver(() => resolve);
        });
    };

    const handleClose = (result: any) => {
        setOpen(false);
        resolver(result);
    };

    return (
        <ConfirmDialogContext.Provider value={{ confirm }}>
            {children}
            <Dialog open={open} onClose={() => handleClose(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{options.title || 'Confirm'}</DialogTitle>
                <DialogContent>
                    <Typography>{options.description || 'Are you sure?'}</Typography>
                    {options.warning && (
                        <Box 
                            sx={{ 
                                mt: 2, 
                                p: 1.5, 
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                backgroundColor: 'rgba(237, 108, 2, 0.1)',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'rgba(237, 108, 2, 0.3)',
                            }}
                        >
                            <WarningAmberIcon sx={{ color: '#ed6c02', fontSize: '1.3rem', mt: 0.1 }} />
                            <Typography sx={{ color: 'text.primary', fontSize: '0.9rem' }}>
                                {options.warning}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {options.actions ? (
                         <>
                            <Button onClick={() => handleClose(false)} color="inherit">
                                {options.cancelText || 'Cancel'}
                            </Button>
                            {options.actions.map((action, idx) => (
                                <Button 
                                    key={idx}
                                    onClick={() => handleClose(action.value)}
                                    color={action.color || "primary"}
                                    variant={action.variant || "contained"}
                                >
                                    {action.label}
                                </Button>
                            ))}
                         </>
                    ) : (
                        <>
                            <Button onClick={() => handleClose(false)} color="inherit">
                                {options.cancelText || 'Cancel'}
                            </Button>
                            <Button onClick={() => handleClose(true)} color="primary" variant="contained">
                                {options.confirmText || 'Confirm'}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </ConfirmDialogContext.Provider>
    );
};

export const useConfirm = () => useContext(ConfirmDialogContext);
