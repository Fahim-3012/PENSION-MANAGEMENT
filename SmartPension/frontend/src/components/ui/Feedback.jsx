import { AlertCircle, AlertTriangle, CheckCircle2, FlaskConical, Inbox, Info, Loader2, RefreshCw, XCircle } from "lucide-react";
import { getErrorMessage } from "../../api/client";
import { useI18n } from "../../context/PreferencesContext";

export function Skeleton({ width = "100%", height = 16, radius, style, className = "" }) {
  return <span className={`skeleton ${className}`} style={{ display: "block", width, height, borderRadius: radius, ...style }} aria-hidden />;
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="stack-sm" style={{ padding: 20 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="row" style={{ gap: 16 }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} height={18} width={`${c === 0 ? 30 : 100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <Skeleton height={14} width="50%" />
          <Skeleton height={28} width="70%" style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label }) {
  const { t } = useI18n();
  return (
    <div className="row" style={{ justifyContent: "center", padding: 32, color: "var(--c-muted)" }} role="status">
      <Loader2 className="spin" size={22} aria-hidden />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden><Icon size={28} /></div>
      {title && <div className="empty-state__title">{title}</div>}
      {message && <p className="empty-state__msg">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }) {
  const { t } = useI18n();
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon" aria-hidden><AlertCircle size={28} /></div>
      <div className="error-state__title">{title || t("common.errorTitle")}</div>
      <p className="error-state__msg">{getErrorMessage(error)}</p>
      {onRetry && (
        <button className="btn btn--outline btn--sm mt-2" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden /> {t("common.retry")}
        </button>
      )}
    </div>
  );
}

const alertIcons = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, demo: FlaskConical };

export function Alert({ tone = "info", title, children, icon, action }) {
  const Icon = icon || alertIcons[tone] || Info;
  return (
    <div className={`alert alert--${tone}`} role={tone === "danger" ? "alert" : "note"}>
      <Icon size={20} aria-hidden />
      <div className="grow">
        {title && <div className="alert__title">{title}</div>}
        {children && <div className="text-sm">{children}</div>}
      </div>
      {action}
    </div>
  );
}
