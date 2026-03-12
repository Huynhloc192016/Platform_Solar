import React, { createContext, useState, useContext, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

const defaultState = {
  open: false,
  title: 'Xác nhận',
  message: '',
  confirmLabel: 'Xác nhận',
  cancelLabel: 'Hủy',
  onConfirm: null,
  onCancel: null,
  variant: 'default', // 'default' | 'destructive'
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(defaultState);

  const close = useCallback(() => {
    setState(defaultState);
  }, []);

  const confirm = useCallback((options) => {
    const {
      title = 'Xác nhận',
      message = '',
      confirmLabel = 'Xác nhận',
      cancelLabel = 'Hủy',
      onConfirm: onConfirmCb,
      onCancel: onCancelCb,
      variant = 'default',
    } = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      setState({
        open: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        variant,
        onConfirm: () => {
          if (onConfirmCb) onConfirmCb();
          close();
          resolve(true);
        },
        onCancel: () => {
          if (onCancelCb) onCancelCb();
          close();
          resolve(false);
        },
      });
    });
  }, [close]);

  const handleConfirm = () => {
    state.onConfirm?.();
  };

  const handleCancel = () => {
    state.onCancel?.();
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            <DialogDescription className="text-sm whitespace-pre-line pt-1">
              {state.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {state.cancelLabel}
            </Button>
            <Button
              type="button"
              variant={state.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              {state.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};
