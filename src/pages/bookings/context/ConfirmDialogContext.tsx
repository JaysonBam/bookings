import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

interface ConfirmOptions {
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
}

interface ConfirmDialogContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType>({
    confirm: async () => false,
});

export const ConfirmDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({});
    const [resolver, setResolver] = useState<(value: boolean) => void>(() => {});

    const confirm = (opts: ConfirmOptions) => {
        setOptions(opts);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolver(() => resolve);
        });
    };

    const handleClose = (result: boolean) => {
        setOpen(false);
        resolver(result);
    };

    return (
        <ConfirmDialogContext.Provider value={{ confirm }}>
            {children}
            <Dialog open={open} onClose={() => handleClose(false)}>
                <DialogTitle>{options.title || 'Confirm'}</DialogTitle>
                <DialogContent>
                    <Typography>{options.description || 'Are you sure?'}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => handleClose(false)} color="inherit">
                        {options.cancelText || 'Cancel'}
                    </Button>
                    <Button onClick={() => handleClose(true)} color="primary" variant="contained">
                        {options.confirmText || 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>
        </ConfirmDialogContext.Provider>
    );
};

export const useConfirm = () => useContext(ConfirmDialogContext);
