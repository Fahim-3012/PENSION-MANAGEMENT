import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { statementApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Button, Card, DataTable, Input, PageHeader, SkeletonCards, StatCard, StatusBadge } from "../../components/ui";
import { toInputDate } from "../../lib/format";

export default function StatementsPage() {
  const { t, formatMoney, formatDateTime } = useI18n();
  const toast = useToast();
  const today = new Date();
  const [range, setRange] = useState({
    from: toInputDate(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
    to: toInputDate(today),
  });
  const [applied, setApplied] = useState(range);
  const [downloading, setDownloading] = useState(false);
  const { data, loading, error, reload } = useApi(() => statementApi.get(applied), [applied.from, applied.to]);
  const invalid = range.from && range.to && range.from > range.to;

  const download = async () => {
    setDownloading(true);
    try { await statementApi.downloadPdf(applied); toast.success(t("stmt.downloaded")); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setDownloading(false); }
  };

  const columns = [
    { key: "createdAt", header: t("common.date"), render: (r) => formatDateTime(r.createdAt) },
    { key: "description", header: t("common.description") },
    { key: "type", header: t("common.type"), render: (r) => <StatusBadge status={r.type} /> },
    { key: "amount", header: t("common.amount"), align: "right",
      render: (r) => <span className={`amount ${r.type === "Credit" ? "amount-credit" : "amount-debit"}`}>{r.type === "Credit" ? "+" : "−"}{formatMoney(r.amount)}</span> },
    { key: "balanceAfter", header: t("common.balance"), align: "right", render: (r) => formatMoney(r.balanceAfter) },
    { key: "reference", header: t("common.reference"), render: (r) => r.reference || "—" },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("stmt.title")} subtitle={t("stmt.sub")}
        actions={<Button icon={Download} onClick={download} loading={downloading} disabled={loading || !!error}>{t("stmt.pdf")}</Button>} />

      <Card>
        <form className="row" style={{ alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); if (!invalid) setApplied(range); }}>
          <Input label={t("common.from")} type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Input label={t("common.to")} type="date" value={range.to} max={toInputDate(today)} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            error={invalid ? "'From' must be before 'To'." : undefined} />
          <Button type="submit" variant="outline" disabled={invalid}>{t("common.apply")}</Button>
        </form>
      </Card>

      {loading && !data ? <SkeletonCards /> : data && (
        <div className="grid grid-4">
          <StatCard label={t("stmt.opening")} value={formatMoney(data.openingBalance)} icon={FileText} />
          <StatCard label={t("stmt.totalCredit")} value={formatMoney(data.totalCredit)} icon={FileText} tone="secondary" index={1} />
          <StatCard label={t("stmt.totalDebit")} value={formatMoney(data.totalDebit)} icon={FileText} tone="danger" index={2} />
          <StatCard label={t("stmt.closing")} value={formatMoney(data.closingBalance)} icon={FileText} tone="accent" index={3} />
        </div>
      )}

      <Card flush>
        <DataTable columns={columns} rows={data?.transactions} loading={loading} error={error} onRetry={reload}
          emptyIcon={FileText} emptyTitle={t("stmt.empty")} caption={t("stmt.title")} />
      </Card>
    </div>
  );
}
