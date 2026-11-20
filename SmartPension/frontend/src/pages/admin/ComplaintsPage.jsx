import { useEffect, useState } from "react";
import { MessageSquareWarning, Reply } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import { Button, Card, DataTable, Modal, PageHeader, Pagination, Select, StatusBadge, Tabs, Textarea } from "../../components/ui";

function RespondModal({ item, onClose, onDone }) {
  const { t, formatDateTime } = useI18n();
  const { busy, run } = useAction();
  const [form, setForm] = useState({ response: "", status: "Resolved" });
  const [error, setError] = useState("");

  useEffect(() => { if (item) { setForm({ response: item.adminResponse || "", status: item.status === "Open" ? "InProgress" : item.status }); setError(""); } }, [item]);

  const submit = () => {
    if (form.response.trim().length < 5) { setError(t("adm.reasonRequired")); return; }
    run(() => adminApi.respondComplaint(item.id, { response: form.response.trim(), status: form.status }), { success: t("adm.done"), onSuccess: onDone });
  };

  return (
    <Modal open={!!item} onClose={onClose} title={t("adm.respond")} size="lg" closeDisabled={busy}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button><Button onClick={submit} loading={busy}>{t("common.submit")}</Button></>}>
      {item && (
        <div className="stack">
          <div>
            <div className="fw-600">{item.subject}</div>
            <div className="text-sm text-muted">{item.pensionerName} ({item.pensionId}) · {t(`sup.cat.${item.category}`)} · {formatDateTime(item.createdAt)}</div>
          </div>
          <p className="card" style={{ padding: 14, whiteSpace: "pre-wrap", background: "var(--c-bg)" }}>{item.message}</p>
          <Textarea label={t("adm.response")} required rows={5} maxLength={2000} value={form.response}
            onChange={(e) => { setForm((f) => ({ ...f, response: e.target.value })); setError(""); }} error={error} data-autofocus />
          <Select label={t("common.status")} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            options={["InProgress", "Resolved", "Closed"].map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        </div>
      )}
    </Modal>
  );
}

export default function ComplaintsPage() {
  const { t, formatDateTime } = useI18n();
  const [status, setStatus] = useState("Open");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const pageSize = 15;
  const list = useApi(() => adminApi.complaints({ page, pageSize, status }), [page, status]);

  const columns = [
    { key: "subject", header: t("sup.subject"), render: (r) => <><div className="fw-600">{r.subject}</div><div className="text-xs text-muted">{t(`sup.cat.${r.category}`)}</div></> },
    { key: "pensionerName", header: t("nav.pensioners"), render: (r) => <><div>{r.pensionerName}</div><div className="text-xs text-muted">{r.pensionId}</div></> },
    { key: "createdAt", header: t("common.date"), render: (r) => formatDateTime(r.createdAt) },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: t("common.actions"), render: (r) => <Button size="sm" variant="outline" icon={Reply} onClick={() => setSelected(r)}>{t("adm.respond")}</Button> },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.complaints")} />
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }}
        tabs={["Open", "InProgress", "Resolved", "Closed", ""].map((s) => ({ value: s, label: s ? t(`status.${s}`) : t("common.all") }))} />
      <Card flush>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload}
          onRowClick={setSelected} emptyIcon={MessageSquareWarning} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>
      <RespondModal item={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); list.reload(); }} />
    </div>
  );
}
