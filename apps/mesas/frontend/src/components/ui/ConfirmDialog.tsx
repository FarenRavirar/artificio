import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { ConfirmContext, type ConfirmOptions } from './confirmDialogContext';
import './ConfirmDialog.css';

/**
 * Modal de confirmação customizado seguindo identidade visual Artifício
 * Substitui window.confirm() com melhor UX e acessibilidade
 */

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolver?.(true);
    setResolver(null);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolver?.(false);
    setResolver(null);
  }, [resolver]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    },
    [handleCancel, handleConfirm]
  );

  // Focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    // Bloquear scroll do body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Salvar elemento com foco anterior
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Obter elementos focáveis
    const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focar primeiro elemento
    firstElement.focus();

    // Handler para trap de foco
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab no primeiro → vai para o último
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab no último → vai para o primeiro
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      // Restaurar scroll
      document.body.style.overflow = originalOverflow;
      // Restaurar foco anterior
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && createPortal(
        <div
          className="confirm-dialog-overlay"
          onClick={handleCancel}
          onKeyDown={handleKeyDown}
        >
          <div
            ref={dialogRef}
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <div className="confirm-dialog-header">
              <div className={`confirm-dialog-icon ${options.variant || 'info'}`}>
                {options.variant === 'danger' && '⚠️'}
                {options.variant === 'warning' && '⚡'}
                {(!options.variant || options.variant === 'info') && 'ℹ️'}
              </div>
              <div className="confirm-dialog-content">
                <h2 id="confirm-dialog-title" className="confirm-dialog-title">
                  {options.title}
                </h2>
                <p id="confirm-dialog-message" className="confirm-dialog-message">
                  {options.message}
                </p>
              </div>
            </div>

            <div className="confirm-dialog-actions">
              <button
                className="confirm-dialog-button confirm-dialog-button-cancel"
                onClick={handleCancel}
                autoFocus={options.variant !== 'danger'}
              >
                {options.cancelText || 'Cancelar'}
              </button>
              <button
                className={`confirm-dialog-button confirm-dialog-button-confirm ${options.variant || ''}`}
                onClick={handleConfirm}
                autoFocus={options.variant === 'danger'}
              >
                {options.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}

