import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import Button from "./Button";
import { Textarea } from "./Form";
import { useI18n } from "../../context/PreferencesContext";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible modal dialog: Esc to close, focus trap, focus restore, scroll lock. */
export function Modal({ open, onClose, title, children, footer, size = "md", closeDisabled = false }) {
  const titleId = useId();
  const ref = useRef(null);
  const { t } = useI18n();
  // Keep latest callbacks in refs so the effect only re-runs when `open` changes (prevents focus jumping).
  const closeRef = useRef(onClose);
  const disabledRef = useRef(closeDisabled);
  closeRef.current = onClose;
  disabledRef.current = closeDisabled;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => {
      const first = ref.current?.querySelector("[data-autofocus]") || ref.current?.querySelector(FOCUSABLE);
      first?.focus();
    }, 30);

    const onKey = (e) => {
      if (e.key === "Escape" && !disabledRef.current) closeRef.current?.();
      if (e.key === "Tab" && ref.current) {
        const items = [...ref.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !closeDisabled) onClose?.(); }}
        >
          <motion.div
            ref={ref}
            className={`modal modal--${size}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="modal__header">
              <h2 className="modal__title" id={titleId}>{title}</h2>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} disabled={closeDisabled} aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body">{children}</div>
            {footer && <div className="modal__footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Confirmation dialog for destructive or important actions. */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, tone = "primary", loading, onConfirm, onCancel, children }) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      closeDisabled={loading}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>{cancelLabel || t("common.cancel")}</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} data-autofocus>{confirmLabel || t("common.confirm")}</Button>
        </>
      }
    >
      {message && <p className="text-muted">{message}</p>}
      {children}
    </Modal>
  );
}

/** Dialog that requires a written reason (rejections, suspensions, failures). */
export function ReasonDialog({ open, title, message, confirmLabel, loading, onConfirm, onCancel, label }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setReason(""); setError(""); } }, [open]);

  const submit = () => {
    if (reason.trim().length < 5) { setError(t("adm.reasonRequired")); return; }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      closeDisabled={loading}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>{t("common.cancel")}</Button>
          <Button variant="danger" onClick={submit} loading={loading}>{confirmLabel || t("adm.reject")}</Button>
        </>
      }
    >
      <div className="stack">
        {message && <p className="text-muted">{message}</p>}
        <Textarea
          label={label || t("adm.rejectReason")}
          required
          value={reason}
          maxLength={500}
          onChange={(e) => { setReason(e.target.value); setError(""); }}
          error={error}
          hint={t("adm.reasonHint")}
          data-autofocus
        />
      </div>
    </Modal>
  );
}
