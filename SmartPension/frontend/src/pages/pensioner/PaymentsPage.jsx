import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { paymentApi } from "../../api/services";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { Card, DataTable, Input, PageHeader, Pagination, Select, StatusBadge, Tabs } from "../../components/ui";

function PaymentsTable() {
  const { t, formatMoney, formatPeriod, formatDateTime } = useI18n();
  const [filters, setFilters] = useState({ status: "", year: "", search: "" });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "period", desc: true });
  const search = useDebounced(filters.search);
  const pageSize = 12;
  const years = useApi(() => paymentApi.years(), []);
  const list = useApi(
    () => paymentApi.list({ page, pageSize, status: filters.status, year: filters.year, search, sortBy: sort.key === "amount" ? "amount" : "", sortDesc: sort.desc }),
    [page, filters.status, filters.year, search, sort.key, sort.desc]
  );

  const setF = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  const onSort = (key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  const columns = useMemo(() => [
    { key: "period", header: t("common.period"), sortable: true, render: (r) => <span className="fw-600">{formatPeriod(r.year, r.month)}</span> },
    { key: "amount", header: t("common.amount"), sortable: true, align: "right", render: (r) => <span className="amount">{formatMoney(r.amount)}</span> },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
    { key: "reference", header: t("common.reference"), render: (r) => r.reference || "—" },
    { key: "processedAt", header: t("common.date"), render: (r) => formatDateTime(r.processedAt) },
    { key: "failureReason", header: t("pay.failure"), render: (r) => r.failureReason ? <span className="text-sm" style={{ color: "var(--c-danger)" }}>{r.failureReason}</span> : "—" },
  ], [t, formatMoney, formatPeriod, formatDateTime]);

  return (
    <>
      <div className="toolbar">
        <Input className="search" type="search" label={t("common.search")} placeholder={t("pay.searchPh")} value={filters.search} onChange={setF("search")} />
        <Select label={t("common.status")} value={filters.status} onChange={setF("status")} placeholder={t("common.all")}
          options={["Success", "Pending", "Failed"].map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        <Select label={t("common.year")} value={filters.year} onChange={setF("year")} placeholder={t("common.all")}
          options={(years.data || []).map((y) => ({ value: String(y), label: String(y) }))} />
      </div>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        sort={sort}
        onSort={onSort}
        emptyIcon={Receipt}
        emptyTitle={t("pay.empty")}
        emptyMessage={t("pay.emptyMsg")}
        caption={t("pay.title")}
      />
      <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
    </>
  );
}

function TransactionsTable() {
  const { t, formatMoney, formatDateTime } = useI18n();
  const [filters, setFilters] = useState({ type: "", from: "", to: "", search: "" });
  const [page, setPage] = useState(1);
  const search = useDebounced(filters.search);
  const pageSize = 12;
  const list = useApi(
    () => paymentApi.transactions({ page, pageSize, type: filters.type, from: filters.from, to: filters.to, search }),
    [page, filters.type, filters.from, filters.to, search]
  );
  const setF = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  const columns = useMemo(() => [
    { key: "createdAt", header: t("common.date"), render: (r) => formatDateTime(r.createdAt) },
    { key: "description", header: t("common.description") },
    { key: "type", header: t("common.type"), render: (r) => <StatusBadge status={r.type} /> },
    { key: "amount", header: t("common.amount"), align: "right",
      render: (r) => <span className={`amount ${r.type === "Credit" ? "amount-credit" : "amount-debit"}`}>{r.type === "Credit" ? "+" : "−"}{formatMoney(r.amount)}</span> },
    { key: "balanceAfter", header: t("common.balance"), align: "right", render: (r) => formatMoney(r.balanceAfter) },
    { key: "reference", header: t("common.reference"), render: (r) => r.reference || "—" },
  ], [t, formatMoney, formatDateTime]);

  return (
    <>
      <div className="toolbar">
        <Input className="search" type="search" label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={filters.search} onChange={setF("search")} />
        <Select label={t("common.type")} value={filters.type} onChange={setF("type")} placeholder={t("common.all")}
          options={["Credit", "Debit"].map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        <Input label={t("common.from")} type="date" value={filters.from} onChange={setF("from")} />
        <Input label={t("common.to")} type="date" value={filters.to} onChange={setF("to")} />
      </div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyIcon={Receipt} emptyTitle={t("pay.empty")} caption={t("pay.transactions")} />
      <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
    </>
  );
}

export default function PaymentsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState("payments");
  return (
    <div className="stack-lg">
      <PageHeader title={t("pay.title")} subtitle={t("pay.sub")} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "payments", label: t("pay.paymentsTab") }, { value: "tx", label: t("pay.transactions") }]} />
      <Card flush>{tab === "payments" ? <PaymentsTable /> : <TransactionsTable />}</Card>
    </div>
  );
}
