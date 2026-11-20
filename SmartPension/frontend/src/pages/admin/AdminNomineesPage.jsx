import { useState } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { Card, DataTable, Input, PageHeader, Pagination } from "../../components/ui";

export default function AdminNomineesPage() {
  const { t, formatDate } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const pageSize = 20;
  const list = useApi(() => adminApi.nominees({ page, pageSize, search: q }), [page, q]);

  const columns = [
    { key: "fullName", header: t("common.name"), sortable: true, render: (r) => <span className="fw-600">{r.fullName}</span> },
    { key: "relationship", header: t("nom.relationship"), render: (r) => t(`nom.rel.${r.relationship}`) },
    { key: "pensionerName", header: t("nav.pensioners"), sortable: true, render: (r) => <><Link to={`/admin/pensioners/${r.pensionerId}`}>{r.pensionerName}</Link><div className="text-xs text-muted">{r.pensionId}</div></> },
    { key: "sharePercentage", header: t("nom.share"), align: "right", sortable: true, render: (r) => `${r.sharePercentage}%` },
    { key: "nidNumber", header: t("nom.nid"), render: (r) => <span className="mono">{r.nidNumber || "—"}</span> },
    { key: "phone", header: t("common.phone"), render: (r) => r.phone || "—" },
    { key: "createdAt", header: t("common.date"), render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.nominees")} />
      <Card flush>
        <div className="toolbar">
          <Input className="search" type="search" aria-label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyIcon={HeartHandshake} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>
    </div>
  );
}
