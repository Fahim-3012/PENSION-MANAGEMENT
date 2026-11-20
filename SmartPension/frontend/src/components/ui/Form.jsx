import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

function FieldShell({ id, label, required, error, hint, children, className = "" }) {
  return (
    <div className={`field ${error ? "field--invalid" : ""} ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">{error}</span>
      ) : (
        hint && <span className="field__hint" id={`${id}-hint`}>{hint}</span>
      )}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const Input = forwardRef(function Input({ label, error, hint, required, className, id: idProp, ...props }, ref) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <input
        ref={ref}
        id={id}
        className="field__control"
        aria-invalid={!!error}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </FieldShell>
  );
});

export function PasswordInput({ label, error, hint, required, className, id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp || autoId;
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <div className="input-group">
        <input
          id={id}
          type={show ? "text" : "password"}
          className="field__control"
          aria-invalid={!!error}
          aria-describedby={describedBy(id, error, hint)}
          {...props}
        />
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm input-group__btn"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </FieldShell>
  );
}

export function Select({ label, error, hint, required, options = [], placeholder, className, id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <select id={id} className="field__control" aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Textarea({ label, error, hint, required, className, id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <textarea id={id} className="field__control" aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...props} />
    </FieldShell>
  );
}

export function Checkbox({ label, checked, onChange, id: idProp, error }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <div className={`field ${error ? "field--invalid" : ""}`}>
      <label className="checkbox" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {error && <span className="field__error" role="alert">{error}</span>}
    </div>
  );
}
