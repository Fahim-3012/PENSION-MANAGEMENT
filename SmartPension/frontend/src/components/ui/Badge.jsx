import { useI18n } from "../../context/PreferencesContext";

const TONES = {
  success: ["Active", "Verified", "Approved", "Success", "Paid", "Resolved", "Credit"],
  warning: ["Pending", "UnderReview", "InProgress", "Open"],
  danger: ["Rejected", "Failed", "Suspended", "Expired"],
  info: ["Debit"],
  neutral: ["Cancelled", "Closed", "NotSubmitted", "None"],
};

export function toneFor(status) {
  for (const [tone, list] of Object.entries(TONES)) if (list.includes(status)) return tone;
  return "neutral";
}

export function Badge({ tone = "neutral", plain, children, className = "" }) {
  return <span className={`badge badge--${tone} ${plain ? "badge--plain" : ""} ${className}`}>{children}</span>;
}

/** Translated, colour-coded status badge for any API status value. */
export function StatusBadge({ status }) {
  const { t } = useI18n();
  if (!status) return null;
  return <Badge tone={toneFor(status)}>{t(`status.${status}`)}</Badge>;
}
