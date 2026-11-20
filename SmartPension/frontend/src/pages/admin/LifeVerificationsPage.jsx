import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CheckCircle2, Image, XCircle } from "lucide-react";
import { adminApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import { Alert, Button, Card, DataTable, Input, Modal, PageHeader, Pagination, ReasonDialog, Spinner, StatusBadge, Tabs } from "../../components/ui";
import { MethodBadge } from "../../components/pension/PensionWidgets";

/** Shows the submitted photo (fetched with auth) and lets the admin approve or reject. */
function ReviewModal({ item, onClose, onApprove, onReject, busy }) {
  const { t, formatDateTime } = useI18n();
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!item) return undefined;
    let objectUrl;
    setUrl(null); setErr(null);
    adminApi.lifePhotoUrl(item.id).then((u) => { objectUrl = u; setUrl(u); }).catch((e) => setErr(getErrorMessage(e)));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item]);

  return (
    <Modal open={!!item} onClose={onClose} title={t("adm.viewPhoto")} size="lg" closeDisabled={busy}
      footer={item?.status === "Pending" && (
        <>
          <Button variant="outline" icon={XCircle} onClick={onReject} disabled={busy}>{t("adm.reject")}</Button>
          <Button variant="secondary" icon={CheckCircle2} onClick={onApprove} loading={busy}>{t("adm.approve")}</Button>
        </>
      )}>
      {item && (
        <div className="stack">
          {item.method === "Manual" ? <Alert tone="info">{t("adm.lifeNotice")}</Alert> : (
            <Alert tone={item.method === "AI-Failed" ? "danger" : "info"} title={t(`face.method.${item.method}`)}>
              {item.matchDistance != null && t("face.distance", { d: item.matchDistance.toFixed(3), limit: "—" })}
              {item.rejectionReason && <div>{item.rejectionReason}</div>}
            </Alert>
          )}
          <div className="row-between">
            <div><div className="fw-600">{item.pensionerName}</div><div className="text-sm text-muted">{item.pensionId} · {formatDateTime(item.submittedAt)}</div></div>
            <StatusBadge status={item.status} />
          </div>
          <div className="camera-frame" style={{ maxWidth: "100%" }}>
            {url ? <img src={url} alt={`Verification photo of ${item.pensionerName}`} style={{ objectFit: "contain" }} />
              : err ? <div className="camera-placeholder">{err}</div>
              : <div className="camera-placeholder"><Spinner /></div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function LifeVerificationsPage() {
  const { t, formatDate, formatDateTime } = useI18n();
  const [status, setStatus] = useState("Pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const q = useDebounced(search);
  const pageSize = 15;
  const list = useApi(() => adminApi.lifeVerifications({ page, pageSize, status, search: q }), [page, status, q]);
  const { busy, run } = useAction();
  const done = () => { setReviewing(null); setRejecting(null); list.reload(); };

  const columns = [
    { key: "pensionerName", header: t("nav.pensioners"), render: (r) => <><Link to={`/admin/pensioners/${r.pensionerId}`} className="fw-600">{r.pensionerName}</Link><div className="text-xs text-muted">{r.pensionId}</div></> },
    { key: "submittedAt", header: t("common.date"), render: (r) => formatDateTime(r.submittedAt) },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status === "Approved" && r.validUntil && new Date(r.validUntil) < new Date() ? "Expired" : r.status} /> },
    { key: "method", header: t("face.methodCol"), render: (r) => <MethodBadge method={r.method} /> },
    { key: "matchDistance", header: t("face.distanceCol"), align: "right", render: (r) => (r.matchDistance != null ? r.matchDistance.toFixed(3) : "—") },
    { key: "validUntil", header: t("common.to"), render: (r) => formatDate(r.validUntil) },
    { key: "rejectionReason", header: t("common.reason"), render: (r) => r.rejectionReason || "—" },
    { key: "actions", header: t("common.actions"), render: (r) => (
      <Button size="sm" variant={r.status === "Pending" ? "secondary" : "outline"} icon={Image} onClick={() => setReviewing(r)}>
        {r.status === "Pending" ? t("adm.startReview") : t("adm.viewPhoto")}
      </Button>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.lifeMonitoring")} subtitle={t("adm.lifeNotice")} />
      <Card flush>
        <div className="toolbar">
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            tabs={["Pending", "Approved", "Expired", "Rejected", ""].map((s) => ({ value: s, label: s ? t(`status.${s}`) : t("common.all") }))} />
          <Input className="search" type="search" aria-label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyIcon={BadgeCheck} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>
      <ReviewModal item={reviewing && !rejecting ? reviewing : null} busy={busy} onClose={() => setReviewing(null)}
        onApprove={() => run(() => adminApi.approveLife(reviewing.id), { onSuccess: done })}
        onReject={() => setRejecting(reviewing)} />
      <ReasonDialog open={!!rejecting} title={t("adm.reject")} loading={busy} message={rejecting?.pensionerName}
        onCancel={() => setRejecting(null)} onConfirm={(reason) => run(() => adminApi.rejectLife(rejecting.id, reason), { onSuccess: done })} />
    </div>
  );
}
