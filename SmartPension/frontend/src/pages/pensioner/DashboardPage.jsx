import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bot, CalendarClock, CircleDollarSign, FileText, HeartHandshake, Landmark, ScanFace, TrendingUp, Wallet,
} from "lucide-react";
import { pensionerApi } from "../../api/services";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { Alert, Button, Card, EmptyState, ErrorState, Segmented, Skeleton, SkeletonCards, StatCard, StatusBadge } from "../../components/ui";
import { GroupedBarChart } from "../../components/charts/Charts";
import { TransactionList, WithdrawalTimeline } from "../../components/pension/PensionWidgets";
import { greetingKey, localized } from "../../lib/format";

function VerificationRow({ icon: Icon, label, status, detail, to, action }) {
  const tone = status === "Verified" ? "success" : status === "Pending" ? "warning" : "danger";
  return (
    <div className="verify-item">
      <span className="verify-item__icon" style={{ background: `var(--c-${tone}-50)`, color: `var(--c-${tone})` }} aria-hidden><Icon size={20} /></span>
      <div className="grow">
        <div className="fw-600">{label}</div>
        {detail && <div className="text-xs text-muted">{detail}</div>}
      </div>
      <div className="stack-sm" style={{ alignItems: "flex-end" }}>
        <StatusBadge status={status} />
        {status !== "Verified" && status !== "Pending" && <Link to={to} className="text-sm fw-600">{action}</Link>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, formatMoney, formatDate, lang } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => pensionerApi.dashboard(), []);
  const [range, setRange] = useState("monthly");
  const yearly = useApi(() => pensionerApi.yearlyChart(), [], { immediate: false });

  const changeRange = (r) => {
    setRange(r);
    if (r === "yearly" && !yearly.data) yearly.run().catch(() => {});
  };

  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;

  if (loading || !data) {
    return (
      <div className="stack-lg" aria-busy="true">
        <Skeleton height={170} radius={18} />
        <SkeletonCards />
        <div className="grid grid-main"><Skeleton height={340} radius={18} /><Skeleton height={340} radius={18} /></div>
      </div>
    );
  }

  const { profile, eligibility: el } = data;
  const name = lang === "bn" ? localized(profile, "fullName", "bn") : profile.fullName;
  const chartData = range === "yearly" ? yearly.data || [] : data.chart;
  const nextText = el.eligible
    ? t("dash.eligibleNow")
    : el.nextEligibleDate ? formatDate(el.nextEligibleDate) : t("dash.notEligible");

  return (
    <div className="stack-lg">
      {profile.status === "Pending" && <Alert tone="warning" title={t("dash.pendingAccount")}>{t("dash.pendingAccountMsg")}</Alert>}
      {profile.status === "Rejected" && <Alert tone="danger" title={t("dash.rejectedAccount")}>{profile.statusReason}</Alert>}
      {profile.status === "Suspended" && <Alert tone="danger" title={t("dash.suspendedAccount")}>{profile.statusReason}</Alert>}

      {/* Welcome hero */}
      <section className="hero" aria-label={t("nav.dashboard")}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero__label">{t(greetingKey())},</div>
          <h1>{name || user?.fullName}</h1>
          <div className="hero__label mt-4">{t("dash.availableBalance")}</div>
          <div className="hero__amount">{formatMoney(profile.balance)}</div>
          <div className="hero__chips">
            {profile.pensionId && <span className="hero__chip">{t("common.pensionId")}: {profile.pensionId}</span>}
            <span className="hero__chip">{t("common.status")}: {t(`status.${profile.status}`)}</span>
            <span className="hero__chip">{t(`pensionType.${profile.pensionType}`)}</span>
          </div>
        </div>
        <div className="hero__right">
          <div className="hero__label">{t("dash.nextWithdrawal")}</div>
          <div style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700 }}>{nextText}</div>
          {el.eligible && <div className="hero__label">{t("dash.upTo", { amount: formatMoney(el.availableBalance) })}</div>}
          <Button variant="accent" to="/app/withdrawals" icon={Wallet} disabled={!el.eligible}>
            {t("dash.withdrawNow")}
          </Button>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-4">
        <StatCard index={0} label={t("dash.monthlyPension")} value={formatMoney(profile.monthlyPensionAmount)} icon={CircleDollarSign} tone="secondary" />
        <StatCard index={1} label={t("dash.receivedThisYear")} value={formatMoney(data.totalReceivedThisYear)} icon={TrendingUp} tone="accent" to="/app/payments" />
        <StatCard index={2} label={t("dash.nextWithdrawal")} value={nextText} icon={CalendarClock} tone="info"
          hint={!el.eligible && el.reasons[0] ? t(`elig.${el.reasons[0]}`) : undefined} to="/app/withdrawals" />
        <StatCard index={3} label={t("dash.nominees")} value={data.nomineeCount} icon={HeartHandshake} tone="primary" to="/app/nominees" />
      </div>

      <div className="grid grid-main">
        <Card
          title={t("dash.paymentsChart")}
          subtitle={t("dash.paymentsChartSub")}
          actions={
            <Segmented
              label={t("common.period")}
              value={range}
              onChange={changeRange}
              options={[{ value: "monthly", label: t("common.monthly") }, { value: "yearly", label: t("common.yearly") }]}
            />
          }
        >
          {range === "yearly" && yearly.loading ? (
            <Skeleton height={280} />
          ) : range === "yearly" && yearly.error ? (
            <ErrorState error={yearly.error} onRetry={yearly.reload} />
          ) : (
            <GroupedBarChart
              data={chartData}
              series={[{ key: "credited", label: t("dash.credited") }, { key: "withdrawn", label: t("dash.withdrawn") }]}
            />
          )}
        </Card>

        <Card title={t("dash.verification")}>
          <VerificationRow
            icon={Landmark}
            label={t("dash.bankStatus")}
            status={data.bankStatus}
            detail={data.primaryBank ? `${data.primaryBank.bankName} ${data.primaryBank.accountNumberMasked}` : undefined}
            to="/app/bank-accounts"
            action={t("bank.add")}
          />
          <VerificationRow
            icon={ScanFace}
            label={t("dash.lifeStatus")}
            status={data.lifeStatus}
            detail={data.lifeValidUntil ? t("dash.validUntil", { date: formatDate(data.lifeValidUntil) }) : undefined}
            to="/app/life-verification"
            action={t("life.startCamera")}
          />
          {!el.eligible && el.reasons.length > 0 && (
            <div className="mt-4">
              <Alert tone="info" title={t("wd.notEligibleTitle")}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {el.reasons.map((r) => <li key={r}>{t(`elig.${r}`)}</li>)}
                </ul>
              </Alert>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-main">
        <Card title={t("dash.recentTx")} actions={<Link to="/app/statements" className="text-sm fw-600">{t("common.viewAll")}</Link>}>
          {data.recentTransactions.length ? (
            <TransactionList items={data.recentTransactions} />
          ) : (
            <EmptyState title={t("common.noData")} />
          )}
        </Card>

        <div className="stack-lg">
          <Card
            title={t("dash.latestWithdrawal")}
            actions={data.latestWithdrawal && <StatusBadge status={data.latestWithdrawal.status} />}
          >
            {data.latestWithdrawal ? (
              <div className="stack">
                <div className="row-between">
                  <span className="amount text-lg">{formatMoney(data.latestWithdrawal.amount)}</span>
                  <Link to={`/app/withdrawals/${data.latestWithdrawal.id}`} className="text-sm fw-600">{t("common.details")}</Link>
                </div>
                <WithdrawalTimeline withdrawal={data.latestWithdrawal} />
              </div>
            ) : (
              <p className="text-muted">{t("dash.noWithdrawal")}</p>
            )}
          </Card>

          <Card title={t("dash.quickActions")}>
            <div className="quick-actions">
              {[
                { to: "/app/withdrawals", icon: Wallet, label: t("wd.new") },
                { to: "/app/statements", icon: FileText, label: t("stmt.pdf") },
                { to: "/app/life-verification", icon: ScanFace, label: t("nav.life") },
                { to: "/app/assistant", icon: Bot, label: t("nav.assistant") },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="quick-action">
                  <span className="quick-action__icon" aria-hidden><a.icon size={20} /></span>
                  <span className="row" style={{ gap: 4 }}>{a.label} <ArrowRight size={14} aria-hidden /></span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
