import { useState } from "react";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import { Button, Card, ConfirmDialog, DataTable, Input, PageHeader, Pagination, ReasonDialog, StatusBadge, Tabs } from "../../components/ui";

export default function BankVerificationsPage() {
  const { t, formatDate } = useI18n();
  const [status, setStatus] = useState("Pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const q = useDebounced(search);
  const pageSize = 15;
  const list = useApi(() => adminApi.bankAccounts({ page, pageSize, status, search: q }), [page, status, q]);
  const { busy, run } = useAction();
  const done = () => { setVerifying(null); setRejecting(null); list.reload(); };

  const columns = [
    { key: "pensionerName", header: t("nav.pensioners"), render: (r) => <><div className="fw-600">{r.pensionerName}</div><div className="text-xs text-muted">{r.pensionId}</div></> },
    { key: "bank", header: t("bank.bankName"), render: (r) => <><div>{r.bankName}</div><div className="text-xs text-muted">{r.branchName}</div></> },
    { key: "accountHolderName", header: t("bank.holder") },
    { key: "accountNumber", header: t("adm.accountNumber"), render: (r) => <span className="mono">{r.accountNumber}</span> },
    { key: "routingNumber", header: t("bank.routing"), render: (r) => r.routingNumber || "—" },
    { key: "createdAt", header: t("common.date"), render: (r) => formatDate(r.createdAt) },
    { key: "status", header: t("common.status"), render: (r) => <><StatusBadge status={r.status} />{r.rejectionReason && <div className="text-xs text-muted">{r.rejectionReason}</div>}</> },
    { key: "actions", header: t("common.actions"), render: (r) => (
      <div className="row" style={{ gap: 6 }}>
        {r.status !== "Verified" && <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => setVerifying(r)}>{t("adm.verify")}</Button>}
        {r.status !== "Rejected" && <Button size="sm" variant="outline" icon={XCircle} onClick={() => setRejecting(r)}>{t("adm.reject")}</Button>}
      </div>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.bankVerification")} subtitle={t("bank.sub")} />
      <Card flush>
        <div className="toolbar">
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            tabs={["Pending", "Verified", "Rejected", ""].map((s) => ({ value: s, label: s ? t(`status.${s}`) : t("common.all") }))} />
          <Input className="search" type="search" aria-label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyIcon={Building2} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>
      <ConfirmDialog open={!!verifying} title={t("adm.verify")} tone="secondary" confirmLabel={t("adm.verify")} loading={busy}
        message={verifying && `${verifying.pensionerName} — ${verifying.bankName} ${verifying.accountNumber}`}
        onCancel={() => setVerifying(null)} onConfirm={() => run(() => adminApi.verifyBank(verifying.id), { onSuccess: done })} />
      <ReasonDialog open={!!rejecting} title={t("adm.reject")} loading={busy} message={rejecting && `${rejecting.pensionerName} — ${rejecting.bankName}`}
        onCancel={() => setRejecting(null)} onConfirm={(reason) => run(() => adminApi.rejectBank(rejecting.id, reason), { onSuccess: done })} />
    </div>
  );
}
