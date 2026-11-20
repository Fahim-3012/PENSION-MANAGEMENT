import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Eye, Send, Wallet, XCircle } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import {
  Alert, Button, Card, ConfirmDialog, DataTable, Input, Modal, PageHeader, Pagination, ReasonDialog, StatusBadge, Tabs,
} from "../../components/ui";

export default function AdminWithdrawalsPage() {
  const { t, formatMoney, formatDateTime } = useI18n();
  const [status, setStatus] = useState("Open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "requestedAt", desc: false });
  const [dialog, setDialog] = useState(null); // { type, row }
  const [reference, setReference] = useState("");
  const q = useDebounced(search);
  const pageSize = 15;
  const list = useApi(() => adminApi.withdrawals({ page, pageSize, status, search: q, sortBy: sort.key === "amount" ? "amount" : "", sortDesc: sort.desc }),
    [page, status, q, sort.key, sort.desc]);
  const { busy, run } = useAction();
  const close = () => { setDialog(null); setReference(""); };
  const done = () => { close(); list.reload(); };
  const row = dialog?.row;

  const columns = [
    { key: "pensionerName", header: t("nav.pensioners"), render: (r) => (
      <><Link to={`/admin/pensioners/${r.pensionerId}`} className="fw-600">{r.pensionerName}</Link><div className="text-xs text-muted">{r.pensionId}</div></>
    ) },
    { key: "amount", header: t("common.amount"), sortable: true, align: "right", render: (r) => (
      <><div className="amount">{formatMoney(r.amount)}</div><div className="text-xs text-muted">{t("common.balance")}: {formatMoney(r.pensionerBalance)}</div></>
    ) },
    { key: "bank", header: t("common.bank"), render: (r) => `${r.bankName} ${r.accountNumberMasked}` },
    { key: "requestedAt", header: t("common.date"), sortable: true, render: (r) => formatDateTime(r.requestedAt) },
    { key: "status", header: t("common.status"), render: (r) => <><StatusBadge status={r.status} />{r.reference && <div className="text-xs text-muted">{r.reference}</div>}</> },
    { key: "actions", header: t("common.actions"), render: (r) => (
      <div className="row" style={{ gap: 6 }}>
        {r.status === "Pending" && <Button size="sm" variant="outline" icon={Eye} onClick={() => setDialog({ type: "review", row: r })}>{t("adm.startReview")}</Button>}
        {(r.status === "Pending" || r.status === "UnderReview") && (
          <>
            <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => setDialog({ type: "approve", row: r })}>{t("adm.approve")}</Button>
            <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setDialog({ type: "reject", row: r })}>{t("adm.reject")}</Button>
          </>
        )}
        {r.status === "Approved" && <Button size="sm" variant="accent" icon={Send} onClick={() => setDialog({ type: "paid", row: r })}>{t("adm.markPaid")}</Button>}
      </div>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.adminWithdrawals")} />
      <Alert tone="demo" title="Bank transfer">{t("adm.paymentNotice")}</Alert>
      <Card flush>
        <div className="toolbar">
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            tabs={["Open", "Approved", "Paid", "Rejected", "Cancelled", ""].map((s) => ({
              value: s, label: s === "Open" ? `${t("status.Pending")} / ${t("status.UnderReview")}` : s ? t(`status.${s}`) : t("common.all"),
            }))} />
          <Input className="search" type="search" aria-label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload}
          sort={sort} onSort={(k) => setSort((s) => (s.key === k ? { key: k, desc: !s.desc } : { key: k, desc: false }))} emptyIcon={Wallet} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>

      <ConfirmDialog open={dialog?.type === "review"} title={t("adm.startReview")} loading={busy}
        message={row && `${row.pensionerName} — ${formatMoney(row.amount)}`}
        onCancel={close} onConfirm={() => run(() => adminApi.reviewWithdrawal(row.id), { onSuccess: done })} />
      <ConfirmDialog open={dialog?.type === "approve"} title={t("adm.approve")} tone="secondary" confirmLabel={t("adm.approve")} loading={busy}
        onCancel={close} onConfirm={() => run(() => adminApi.approveWithdrawal(row.id), { onSuccess: done })}>
        {row && (
          <dl className="dl">
            <dt>{t("nav.pensioners")}</dt><dd>{row.pensionerName}</dd>
            <dt>{t("common.amount")}</dt><dd className="amount">{formatMoney(row.amount)}</dd>
            <dt>{t("adm.balanceAfter")}</dt><dd>{formatMoney(row.pensionerBalance)} → {formatMoney(row.pensionerBalance - row.amount)}</dd>
            <dt>{t("common.bank")}</dt><dd>{row.bankName} {row.accountNumberMasked}</dd>
          </dl>
        )}
      </ConfirmDialog>
      <ReasonDialog open={dialog?.type === "reject"} title={t("adm.reject")} loading={busy}
        message={row && `${row.pensionerName} — ${formatMoney(row.amount)}`}
        onCancel={close} onConfirm={(reason) => run(() => adminApi.rejectWithdrawal(row.id, reason), { onSuccess: done })} />
      <Modal open={dialog?.type === "paid"} onClose={close} title={t("adm.markPaid")} closeDisabled={busy}
        footer={<><Button variant="outline" onClick={close} disabled={busy}>{t("common.cancel")}</Button>
          <Button variant="secondary" loading={busy} onClick={() => run(() => adminApi.markWithdrawalPaid(row.id, reference.trim() || null), { onSuccess: done })}>{t("common.confirm")}</Button></>}>
        <div className="stack">
          {row && <p>{row.pensionerName} — <strong>{formatMoney(row.amount)}</strong> → {row.bankName} {row.accountNumberMasked}</p>}
          <Input label={t("adm.transferRef")} hint={t("adm.transferHint")} maxLength={60} value={reference} onChange={(e) => setReference(e.target.value)} data-autofocus />
        </div>
      </Modal>
    </div>
  );
}
