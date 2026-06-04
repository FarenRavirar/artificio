import { useContext } from 'react';
import { ConfirmContext, type ConfirmContextValue } from './confirmDialogContext';

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider');
  }

  return context;
}
