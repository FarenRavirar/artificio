import React, { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  variant?: "danger" | "warning" | "info";
  confirmText?: string;
  cancelText?: string;
}

export interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm deve ser usado dentro de um ConfirmProvider");
  }
  return context;
}

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
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    },
    [handleCancel, handleConfirm],
  );

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && createPortal(
        <div
          className="artificio-confirm-overlay"
          onClick={handleCancel}
          onKeyDown={handleKeyDown}
        >
          <div
            ref={dialogRef}
            className="artificio-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <div className="artificio-confirm-header">
              <div className={`artificio-confirm-icon artificio-confirm-icon-${options.variant || "info"}`}>
                {options.variant === "danger" && "\u26A0\uFE0F"}
                {options.variant === "warning" && "\u26A1"}
                {(!options.variant || options.variant === "info") && "\u2139\uFE0F"}
              </div>
              <div className="artificio-confirm-content">
                <h2 id="confirm-dialog-title" className="artificio-confirm-title">
                  {options.title}
                </h2>
                <p id="confirm-dialog-message" className="artificio-confirm-message">
                  {options.message}
                </p>
              </div>
            </div>

            <div className="artificio-confirm-actions">
              <button
                className="artificio-confirm-btn-cancel"
                onClick={handleCancel}
                autoFocus={options.variant !== "danger"}
              >
                {options.cancelText || "Cancelar"}
              </button>
              <button
                className={`artificio-confirm-btn-confirm ${options.variant === "danger" ? "artificio-confirm-btn-confirm-danger" : ""}`}
                onClick={handleConfirm}
                autoFocus={options.variant === "danger"}
              >
                {options.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ConfirmContext.Provider>
  );
}

export default ConfirmProvider;
