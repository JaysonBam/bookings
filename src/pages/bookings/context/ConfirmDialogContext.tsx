import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

interface ConfirmAction {
    label: string;
    value: any;
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    variant?: 'text' | 'outlined' | 'contained';
}

interface ConfirmOptions {
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    // New: Custom actions beyond yes/no
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
