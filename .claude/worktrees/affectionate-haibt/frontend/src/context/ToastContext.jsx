import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

let _id = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    // Remove after exit animation
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  const addToast = useCallback((type, message, duration = 3000) => {
    const id = ++_id;
    setToasts(prev => [{ id, type, message, leaving: false }, ...prev]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, duration) => addToast('success', msg, duration),
    error:   (msg, duration) => addToast('error',   msg, duration),
    info:    (msg, duration) => addToast('info',    msg, duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

/* ── Toast Stack UI ──────────────────────────────────────────── */
const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#4caf50" />
      <path d="M5 9l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#f44336" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#2196f3" />
      <path d="M9 8v5M9 6h.01" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

const ToastStack = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
          role="alert"
        >
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">×</button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
};
