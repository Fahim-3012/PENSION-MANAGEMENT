import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertOctagon, BadgeCheck, Banknote, Building2, CheckCircle2, Clock, Database, MessageSquareWarning, PiggyBank,
  UserCheck, Users, Wallet,
} from "lucide-react";
import { adminApi } from "../../api/services";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { Card, DataTable, ErrorState, PageHeader, Segmented, Skeleton, SkeletonCards, StatCard, StatusBadge } from "../../components/ui";
import { DonutChart, GroupedBarChart } from "../../components/charts/Charts";

export default function AdminDashboardPage() {
  const { t, formatMoney, formatNumber, formatDate } = useI18n();
  const navigate = useNavigate();
  const [range, setRange] = useState("monthly");
  const dash = useApi(() => adminApi.dashboard(), []);
  const analytics = useApi(() => adminApi.analytics(range), [range]);
  const d = dash.data;

  if (dash.error) return <Card><ErrorState error={dash.error} onRetry={dash.reload} /></Card>;

  const cards = d ? [
    { label: t("adm.totalPensioners"), value: formatNumber(d.totalPensioners), icon: Users, tone: "primary", to: "/admin/pensioners" },
    { label: t("adm.active"), value: formatNumber(d.activeAccounts), icon: UserCheck, tone: "secondary", to: "/admin/pensioners" },
    { label: t("adm.unclaimed"), value: formatNumber(d.unclaimedRecords), icon: Database, tone: "warning", to: "/admin/registry",
      hint: t("adm.ofRecords", { total: formatNumber(d.registryRecords) }) },
    { label: t("adm.pendingWithdrawals"), value: formatNumber(d.pendingWithdrawals), icon: Clock, tone: "accent", to: "/admin/withdrawals",
      hint: d.approvedAwaitingPayout ? `${formatNumber(d.approvedAwaitingPayout)} ${t("adm.awaitingPayout").toLowerCase()}` : undefined },
    { label: t("adm.successPayments"), value: formatNumber(d.successfulPayments), icon: CheckCircle2, tone: "secondary", to: "/admin/payments", hint: formatMoney(d.successfulPaymentAmount) },
    { label: t("adm.failedPayments"), value: formatNumber(d.failedPayments), icon: AlertOctagon, tone: "danger", to: "/admin/payments" },
    { label: t("adm.disbursedMonth"), value: formatMoney(d.disbursedThisMonth), icon: Banknote, tone: "info", to: "/admin/payments" },
    { label: t("adm.balanceHeld"), value: formatMoney(d.totalBalanceHeld), icon: PiggyBank, tone: "accent" },
  ] : [];

  const queues = d ? [
    { label: t("adm.pendingBank"), value: d.pendingBankVerifications, icon: Building2, to: "/admin/bank-verifications" },
    { label: t("adm.pendingLife"), value: d.pendingLifeVerifications, icon: BadgeCheck, to: "/admin/life-verifications" },
    { label: t("adm.openComplaints"), value: d.openComplaints, icon: MessageSquareWarning, to: "/admin/complaints" },
    { label: t("adm.awaitingPayout"), value: d.approvedAwaitingPayout, icon: Wallet, to: "/admin/withdrawals" },
  ] : [];

  return (
    <div className="stack-lg">
      <PageHeader title={t("adm.welcome")} subtitle={t("adm.sub")} />

      {!d ? <><SkeletonCards /><SkeletonCards /></> : (
        <div className="grid grid-4">
          {cards.map((c, i) => <StatCard key={c.label} index={i} {...c} />)}
        </div>
      )}

      <div className="grid grid-main">
        <Card
          title={t("adm.analytics")}
          subtitle={t("adm.analyticsSub")}
          actions={<Segmented label={t("common.period")} value={range} onChange={setRange}
            options={[{ value: "monthly", label: t("common.monthly") }, { value: "yearly", label: t("common.yearly") }]} />}
        >
          {analytics.error ? <ErrorState error={analytics.error} onRetry={analytics.reload} />
            : !analytics.data ? <Skeleton height={300} />
            : (
              <GroupedBarChart
                data={analytics.data.series}
                series={[{ key: "disbursed", label: t("adm.disbursed") }, { key: "withdrawn", label: t("adm.withdrawn") }]}
                height={300}
              />
            )}
        </Card>
        <Card title={t("dash.quickActions")}>
          {!d ? <Skeleton height={200} /> : (
            <div className="stack-sm">
              {queues.map((q) => (
                <Link key={q.to + q.label} to={q.to} className="verify-item" style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="verify-item__icon" style={{ background: "var(--c-primary-50)", color: "var(--c-primary)" }} aria-hidden><q.icon size={20} /></span>
                  <span className="grow fw-600">{q.label}</span>
                  <span className={`badge ${q.value ? "badge--warning" : "badge--neutral"} badge--plain`}>{formatNumber(q.value)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title={t("adm.byStatus")}>
          {analytics.data ? <DonutChart data={analytics.data.pensionersByStatus} labelFor={(n) => t(`status.${n}`)} /> : <Skeleton height={200} />}
        </Card>
        <Card title={t("adm.byType")}>
          {analytics.data ? <DonutChart data={analytics.data.pensionersByType} labelFor={(n) => t(`pensionType.${n}`)} /> : <Skeleton height={200} />}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title={t("adm.recentWithdrawals")} flush actions={<Link to="/admin/withdrawals" className="text-sm fw-600">{t("common.viewAll")}</Link>}>
          <DataTable
            rows={d?.recentWithdrawals}
            loading={!d}
            onRowClick={() => navigate("/admin/withdrawals")}
            columns={[
              { key: "pensionerName", header: t("common.name"), render: (r) => <><div className="fw-600">{r.pensionerName}</div><div className="text-xs text-muted">{r.pensionId}</div></> },
              { key: "amount", header: t("common.amount"), align: "right", render: (r) => formatMoney(r.amount) },
              { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Card>
        <Card title={t("adm.recentRegistrations")} flush actions={<Link to="/admin/pensioners" className="text-sm fw-600">{t("common.viewAll")}</Link>}>
          <DataTable
            rows={d?.recentRegistrations}
            loading={!d}
            onRowClick={(r) => navigate(`/admin/pensioners/${r.id}`)}
            columns={[
              { key: "fullName", header: t("common.name"), render: (r) => <><div className="fw-600">{r.fullName}</div><div className="text-xs text-muted">{r.pensionId}</div></> },
              { key: "createdAt", header: t("common.date"), render: (r) => formatDate(r.createdAt) },
              { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
