import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);
const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const colors = { success: "var(--c-success)", error: "var(--c-danger)", info: "var(--c-info)", warning: "var(--c-accent-600)" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message, duration = 4500) => {
    const id = ++idRef.current;
    setToasts((list) => [...list.slice(-3), { id, type, message }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, d) => push("success", m, d),
    error: (m, d) => push("error", m, d ?? 6500),
    info: (m, d) => push("info", m, d),
    warning: (m, d) => push("warning", m, d),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = icons[toast.type] || Info;
            return (
              <motion.div
                key={toast.id}
                className={`toast toast--${toast.type}`}
                role={toast.type === "error" ? "alert" : "status"}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.2 }}
              >
                <Icon size={20} color={colors[toast.type]} aria-hidden />
                <div className="toast__msg">{toast.message}</div>
                <button className="btn btn--ghost btn--icon btn--sm" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
