import { ref } from 'vue';

export interface ToastOptions {
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  link?: string;
  linkText?: string;
}

interface Toast extends ToastOptions {
  id: number;
}

// Global state
const toasts = ref<Toast[]>([]);
let toastId = 0;

export function useToast() {
  function addToast(options: ToastOptions) {
    const id = ++toastId;
    const toast: Toast = {
      id,
      type: 'info',
      duration: 5000,
      ...options,
    };

    toasts.value.push(toast);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration);
    }

    return id;
  }

  function removeToast(id: number) {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  }

  function success(title: string, options?: Partial<Omit<ToastOptions, 'title' | 'type'>>) {
    return addToast({ title, type: 'success', ...options });
  }

  function error(title: string, options?: Partial<Omit<ToastOptions, 'title' | 'type'>>) {
    return addToast({ title, type: 'error', duration: 8000, ...options });
  }

  function info(title: string, options?: Partial<Omit<ToastOptions, 'title' | 'type'>>) {
    return addToast({ title, type: 'info', ...options });
  }

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
  };
}
