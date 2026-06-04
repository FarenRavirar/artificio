import toast from 'react-hot-toast';

/**
 * Utilitário centralizado para toasts
 * Garante consistência de duração e estilo em toda a aplicação
 */

export const showSuccess = (message: string, duration = 3000) => {
  return toast.success(message, { duration });
};

export const showError = (message: string, duration = 4000) => {
  return toast.error(message, { duration });
};

export const showInfo = (message: string, duration = 3000) => {
  return toast(message, { duration });
};

export const showWarning = (message: string, duration = 4000) => {
  return toast(message, {
    duration,
    icon: '⚠️',
  });
};
