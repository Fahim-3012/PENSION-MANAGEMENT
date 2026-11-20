import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Badge, Timeline } from "../ui";
import { useI18n } from "../../context/PreferencesContext";

/** Builds the withdrawal status timeline from real timestamps returned by the API. */
export function WithdrawalTimeline({ withdrawal: w }) {
  const { t, formatDateTime } = useI18n();
  if (!w) return null;
  const items = [{ title: t("wd.tlSubmitted"), time: formatDateTime(w.requestedAt), state: "done" }];

  if (w.status === "Cancelled") {
    items.push({ title: t("wd.tlCancelled"), time: formatDateTime(w.cancelledAt), state: "failed" });
    return <Timeline items={items} />;
  }
  if (w.status === "Rejected") {
    if (w.reviewStartedAt) items.push({ title: t("wd.tlReview"), time: formatDateTime(w.reviewStartedAt), state: "done" });
    items.push({ title: t("wd.tlRejected"), time: formatDateTime(w.reviewedAt), description: w.rejectionReason, state: "failed" });
    return <Timeline items={items} />;
  }

  const reviewDone = !!w.reviewStartedAt || ["Approved", "Paid"].includes(w.status);
  items.push({
    title: t("wd.tlReview"),
    time: w.reviewStartedAt ? formatDateTime(w.reviewStartedAt) : t("wd.waiting"),
    state: reviewDone ? (w.status === "UnderReview" ? "current" : "done") : "current",
  });
  items.push({
    title: t("wd.tlApproved"),
    time: w.reviewedAt ? formatDateTime(w.reviewedAt) : t("wd.waiting"),
    description: w.reference && ["Approved", "Paid"].includes(w.status) ? `${t("common.reference")}: ${w.reference}` : undefined,
    state: ["Approved", "Paid"].includes(w.status) ? "done" : "pending",
  });
  items.push({
    title: t("wd.tlPaid"),
    time: w.paidAt ? formatDateTime(w.paidAt) : t("wd.waiting"),
    description: `${w.bankName} ${w.accountNumberMasked}`,
    state: w.status === "Paid" ? "done" : w.status === "Approved" ? "current" : "pending",
  });
  return <Timeline items={items} />;
}

/** Compact list of ledger transactions. */
export function TransactionList({ items }) {
  const { t, formatMoney, formatDate } = useI18n();
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((tx) => {
        const credit = tx.type === "Credit";
        const Icon = credit ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={tx.id} className="verify-item">
            <span className="verify-item__icon" style={{ background: credit ? "var(--c-success-50)" : "var(--c-danger-50)", color: credit ? "var(--c-success)" : "var(--c-danger)" }} aria-hidden>
              <Icon size={18} />
            </span>
            <div className="grow">
              <div className="fw-600" style={{ fontSize: "0.94rem" }}>{tx.description}</div>
              <div className="text-xs text-muted">{formatDate(tx.createdAt)} · {tx.reference || "—"}</div>
            </div>
            <div className="text-right">
              <div className={`amount ${credit ? "amount-credit" : "amount-debit"}`}>
                <span className="sr-only">{t(`status.${tx.type}`)} </span>{credit ? "+" : "−"}{formatMoney(tx.amount)}
              </div>
              <div className="text-xs text-muted">{t("common.balance")}: {formatMoney(tx.balanceAfter)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** How a life verification was decided: Manual review, AI enrolment, AI match passed or failed. */
export function MethodBadge({ method }) {
  const { t } = useI18n();
  const tone = method === "AI" || method === "AI-Enrollment" ? "info" : method === "AI-Failed" ? "danger" : "neutral";
  return <Badge tone={tone} plain>{t(`face.method.${method}`)}</Badge>;
}
