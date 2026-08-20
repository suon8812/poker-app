import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
}

interface UIState {
  toasts: Toast[];
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let counter = 0;

export const useUIStore = create<UIState>(set => ({
  toasts: [],
  pushToast: (message: string) => {
    const id = ++counter;
    set(state => ({ toasts: [...state.toasts, { id, message }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3500);
  },
  dismissToast: (id: number) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));
