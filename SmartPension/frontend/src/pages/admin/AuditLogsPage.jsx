import { useState } from "react";
import { ScrollText } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { Badge, Card, DataTable, Input, PageHeader, Pagination, Select } from "../../components/ui";

export default function AuditLogsPage() {
  const { t, formatDateTime } = useI18n();
  const [filters, setFilters] = useState({ search: "", action: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const q = useDebounced(filters.search);
  const pageSize = 25;
  const actions = useApi(() => adminApi.auditActions(), []);
  const list = useApi(() => adminApi.auditLogs({ page, pageSize, search: q, action: filters.action, from: filters.from, to: filters.to }),
    [page, q, filters.action, filters.from, filters.to]);
  const setF = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  const tone = (a) => (/Rejected|Failed|Suspended|Locked|Deactivated/.test(a) ? "danger" : /Approved|Verified|Succeeded|Paid|Created|Activated/.test(a) ? "success" : "neutral");

  const columns = [
    { key: "createdAt", header: t("common.date"), render: (r) => <span className="nowrap">{formatDateTime(r.createdAt)}</span> },
    { key: "userEmail", header: t("adm.user"), render: (r) => r.userEmail || "—" },
    { key: "action", header: t("adm.action"), render: (r) => <Badge tone={tone(r.action)} plain>{r.action}</Badge> },
    { key: "entity", header: t("adm.entity"), render: (r) => `${r.entityType}${r.entityId ? ` #${r.entityId}` : ""}` },
    { key: "details", header: t("common.details"), render: (r) => <span className="text-sm">{r.details || "—"}</span> },
    { key: "ipAddress", header: t("adm.ip"), render: (r) => <span className="mono text-sm">{r.ipAddress || "—"}</span> },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.audit")} />
      <Card flush>
        <div className="toolbar">
          <Input className="search" type="search" label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={filters.search} onChange={setF("search")} />
          <Select label={t("adm.action")} value={filters.action} onChange={setF("action")} placeholder={t("common.all")}
            options={(actions.data || []).map((a) => ({ value: a, label: a }))} />
          <Input label={t("common.from")} type="date" value={filters.from} onChange={setF("from")} />
          <Input label={t("common.to")} type="date" value={filters.to} onChange={setF("to")} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyIcon={ScrollText} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>
    </div>
  );
}
