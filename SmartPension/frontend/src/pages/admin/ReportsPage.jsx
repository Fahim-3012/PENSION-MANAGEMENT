import { useState } from "react";
import { AlertOctagon, BadgeCheck, Banknote, ClipboardCheck, Download, FileSpreadsheet, MessageSquareWarning, UserPlus, Wallet, XCircle } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import { Button, Card, ErrorState, Input, PageHeader, SkeletonCards, StatCard } from "../../components/ui";
import { toInputDate } from "../../lib/format";

export default function ReportsPage() {
  const { t, formatMoney, formatNumber, formatDate } = useI18n();
  const today = new Date();
  const [range, setRange] = useState({ from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toInputDate(today) });
  const [applied, setApplied] = useState(range);
  const { data, loading, error, reload } = useApi(() => adminApi.reportSummary(applied), [applied.from, applied.to]);
  const pdf = useAction();
  const csv = useAction();
  const invalid = range.from > range.to;

  const cards = data ? [
    { label: t("adm.newPensioners"), value: formatNumber(data.newRegistrations), icon: UserPlus },
    { label: t("adm.approved"), value: formatNumber(data.approvals), icon: ClipboardCheck, tone: "secondary" },
    { label: t("adm.successPayments"), value: formatNumber(data.paymentsSucceeded), icon: Banknote, tone: "secondary", hint: formatMoney(data.amountDisbursed) },
    { label: t("adm.failedPayments"), value: formatNumber(data.paymentsFailed), icon: AlertOctagon, tone: "danger" },
    { label: t("status.Approved"), value: formatNumber(data.withdrawalsApproved), icon: Wallet, tone: "accent", hint: formatMoney(data.amountWithdrawn) },
    { label: t("status.Rejected"), value: formatNumber(data.withdrawalsRejected), icon: XCircle, tone: "warning" },
    { label: t("nav.lifeMonitoring"), value: formatNumber(data.lifeVerificationsApproved), icon: BadgeCheck, tone: "info" },
    { label: t("nav.complaints"), value: formatNumber(data.complaintsReceived), icon: MessageSquareWarning },
  ] : [];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.reports")} subtitle={data && `${formatDate(data.from)} – ${formatDate(data.to)}`}
        actions={<>
          <Button variant="outline" icon={FileSpreadsheet} loading={csv.busy} disabled={!data} onClick={() => csv.run(() => adminApi.reportCsv(applied), { success: t("adm.done") })}>{t("adm.exportCsv")}</Button>
          <Button icon={Download} loading={pdf.busy} disabled={!data} onClick={() => pdf.run(() => adminApi.reportPdf(applied), { success: t("adm.done") })}>{t("adm.exportPdf")}</Button>
        </>} />
      <Card>
        <form className="row" style={{ alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); if (!invalid) setApplied(range); }}>
          <Input label={t("common.from")} type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Input label={t("common.to")} type="date" value={range.to} max={toInputDate(today)} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            error={invalid ? "'From' must be before 'To'." : undefined} />
          <Button type="submit" variant="outline" disabled={invalid}>{t("common.apply")}</Button>
        </form>
      </Card>
      {error ? <Card><ErrorState error={error} onRetry={reload} /></Card>
        : loading && !data ? <><SkeletonCards /><SkeletonCards /></>
        : (
          <Card title={t("adm.reportSummary")}>
            <div className="grid grid-4">{cards.map((c, i) => <StatCard key={c.label} index={i} {...c} />)}</div>
          </Card>
        )}
    </div>
  );
}
