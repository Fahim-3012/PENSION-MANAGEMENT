import { useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, PlayCircle, PlusCircle, RotateCcw, XCircle } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import { Alert, Button, Card, ConfirmDialog, DataTable, Input, PageHeader, Pagination, ReasonDialog, Select, StatusBadge, Tabs } from "../../components/ui";

export default function AdminPaymentsPage() {
  const { t, formatMoney, formatPeriod, formatDateTime, locale } = useI18n();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { type, row? }
  const q = useDebounced(search);
  const pageSize = 15;
  const list = useApi(() => adminApi.payments({ page, pageSize, status, search: q, year: period.year, month: period.month }),
    [page, status, q, period.year, period.month]);
  const { busy, run } = useAction();
  const close = () => setDialog(null);
  const done = () => { close(); list.reload(); };
  const row = dialog?.row;
  const periodLabel = formatPeriod(period.year, period.month);

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const columns = [
    { key: "pensionerName", header: t("nav.pensioners"), render: (r) => <><Link to={`/admin/pensioners/${r.pensionerId}`} className="fw-600">{r.pensionerName}</Link><div className="text-xs text-muted">{r.pensionId}</div></> },
    { key: "period", header: t("common.period"), render: (r) => formatPeriod(r.year, r.month) },
    { key: "amount", header: t("common.amount"), align: "right", render: (r) => <span className="amount">{formatMoney(r.amount)}</span> },
    { key: "status", header: t("common.status"), render: (r) => <><StatusBadge status={r.status} />{r.failureReason && <div className="text-xs" style={{ color: "var(--c-danger)" }}>{r.failureReason}</div>}</> },
    { key: "reference", header: t("common.reference"), render: (r) => r.reference || "—" },
    { key: "processedAt", header: t("common.date"), render: (r) => formatDateTime(r.processedAt) },
    { key: "actions", header: t("common.actions"), render: (r) => (
      <div className="row" style={{ gap: 6 }}>
        {r.status === "Pending" && <>
          <Button size="sm" variant="secondary" icon={PlayCircle} onClick={() => setDialog({ type: "process", row: r })}>{t("adm.process")}</Button>
          <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setDialog({ type: "fail", row: r })}>{t("adm.markFailed")}</Button>
        </>}
        {r.status === "Failed" && <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => setDialog({ type: "retry", row: r })}>{t("adm.retry")}</Button>}
      </div>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.adminPayments")}
        actions={<>
          <Button variant="outline" icon={PlusCircle} onClick={() => setDialog({ type: "generate" })}>{t("adm.generate")}</Button>
          <Button icon={PlayCircle} onClick={() => setDialog({ type: "batch" })}>{t("adm.processBatch")}</Button>
        </>} />
      <Alert tone="demo" title="No payment gateway configured">{t("adm.paymentNotice")}</Alert>

      <Card flush>
        <div className="toolbar">
          <Select label={t("common.year")} value={period.year} onChange={(e) => { setPeriod((p) => ({ ...p, year: Number(e.target.value) })); setPage(1); }}
            options={years.map((y) => ({ value: y, label: String(y) }))} />
          <Select label={t("common.month")} value={period.month} onChange={(e) => { setPeriod((p) => ({ ...p, month: Number(e.target.value) })); setPage(1); }}
            options={months.map((m) => ({ value: m, label: new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, m - 1, 1)) }))} />
          <Input className="search" type="search" label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            tabs={["", "Pending", "Success", "Failed"].map((s) => ({ value: s, label: s ? t(`status.${s}`) : t("common.all") }))} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyIcon={Banknote} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>

      <ConfirmDialog open={dialog?.type === "generate"} title={`${t("adm.generate")} — ${periodLabel}`} loading={busy}
        message="Creates a pending payment for every active pensioner who does not yet have one for this period."
        onCancel={close} onConfirm={() => run(() => adminApi.generatePayments(period.year, period.month), { onSuccess: done })} />
      <ConfirmDialog open={dialog?.type === "batch"} title={`${t("adm.processBatch")} — ${periodLabel}`} loading={busy} tone="secondary"
        message="Each pending payment is checked (active account, valid life verification) and credited or marked failed."
        onCancel={close} onConfirm={() => run(() => adminApi.processBatch(period.year, period.month), { onSuccess: done })} />
      <ConfirmDialog open={dialog?.type === "process"} title={t("adm.process")} loading={busy} tone="secondary"
        message={row && `${row.pensionerName} — ${formatPeriod(row.year, row.month)} — ${formatMoney(row.amount)}`}
        onCancel={close} onConfirm={() => run(() => adminApi.processPayment(row.id), { onSuccess: done })} />
      <ConfirmDialog open={dialog?.type === "retry"} title={t("adm.retry")} loading={busy}
        message={row && `${row.pensionerName} — ${formatPeriod(row.year, row.month)}`}
        onCancel={close} onConfirm={() => run(() => adminApi.retryPayment(row.id), { onSuccess: done })} />
      <ReasonDialog open={dialog?.type === "fail"} title={t("adm.markFailed")} confirmLabel={t("adm.markFailed")} label={t("pay.failure")} loading={busy}
        message={row && `${row.pensionerName} — ${formatMoney(row.amount)}`}
        onCancel={close} onConfirm={(reason) => run(() => adminApi.failPayment(row.id, reason), { onSuccess: done })} />
    </div>
  );
}
