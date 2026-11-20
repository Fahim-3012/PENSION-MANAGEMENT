import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { Card, DataTable, Input, PageHeader, Pagination, Select, StatusBadge } from "../../components/ui";
import { PENSION_TYPES } from "../../lib/format";

export default function PensionersPage() {
  const { t, formatMoney, formatDate } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [status, setStatus] = useState(params.get("status") || "");
  const [pensionType, setPensionType] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "createdAt", desc: true });
  const q = useDebounced(search);
  const pageSize = 15;

  const list = useApi(
    () => adminApi.pensioners({ page, pageSize, search: q, status, pensionType, sortBy: sort.key === "fullName" ? "name" : sort.key === "monthlyPensionAmount" ? "amount" : sort.key === "balance" ? "balance" : "", sortDesc: sort.desc }),
    [page, q, status, pensionType, sort.key, sort.desc]
  );

  const onSort = (key) => { setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: false })); setPage(1); };
  const updateSearch = (v) => {
    setSearch(v); setPage(1);
    const next = new URLSearchParams(params);
    if (v) next.set("search", v); else next.delete("search");
    setParams(next, { replace: true });
  };

  const columns = useMemo(() => [
    { key: "fullName", header: t("common.name"), sortable: true, render: (r) => (
      <div><div className="fw-600">{r.fullName}</div><div className="text-xs text-muted">{r.pensionId} · {r.email}</div></div>
    ) },
    { key: "pensionType", header: t("common.type"), render: (r) => t(`pensionType.${r.pensionType}`) },
    { key: "monthlyPensionAmount", header: t("dash.monthlyPension"), sortable: true, align: "right", render: (r) => formatMoney(r.monthlyPensionAmount) },
    { key: "balance", header: t("common.balance"), sortable: true, align: "right", render: (r) => formatMoney(r.balance) },
    { key: "bankStatus", header: t("dash.bankStatus"), render: (r) => <StatusBadge status={r.bankStatus} /> },
    { key: "lifeStatus", header: t("dash.lifeStatus"), render: (r) => <StatusBadge status={r.lifeStatus} /> },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: t("common.date"), sortable: true, render: (r) => formatDate(r.createdAt) },
  ], [t, formatMoney, formatDate]);

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.pensioners")} subtitle={list.data ? `${list.data.total}` : undefined} />
      <Card flush>
        <div className="toolbar">
          <Input className="search" type="search" label={t("common.search")} placeholder={t("adm.searchPh")} value={search} onChange={(e) => updateSearch(e.target.value)} />
          <Select label={t("common.status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t("common.all")}
            options={["Pending", "Active", "Suspended", "Rejected"].map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          <Select label={t("common.type")} value={pensionType} onChange={(e) => { setPensionType(e.target.value); setPage(1); }} placeholder={t("common.all")}
            options={PENSION_TYPES.map((s) => ({ value: s, label: t(`pensionType.${s}`) }))} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload}
          sort={sort} onSort={onSort} onRowClick={(r) => navigate(`/admin/pensioners/${r.id}`)} emptyIcon={Users} caption={t("nav.pensioners")} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>
    </div>
  );
}
