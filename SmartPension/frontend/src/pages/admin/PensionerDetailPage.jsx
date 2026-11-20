import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Pencil, RotateCcw, ScanFace } from "lucide-react";
import { MethodBadge } from "../../components/pension/PensionWidgets";
import { adminApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, ConfirmDialog, DataTable, ErrorState, PageHeader, ReasonDialog, Skeleton, StatusBadge, Tabs } from "../../components/ui";
import { AmountModal } from "../../components/admin/PensionerActions";

export default function PensionerDetailPage() {
  const { id } = useParams();
  const { t, formatMoney, formatDate, formatDateTime, formatPeriod } = useI18n();
  const toast = useToast();
  const { data: p, loading, error, reload } = useApi(() => adminApi.pensioner(id), [id]);
  const [dialog, setDialog] = useState(null); // suspend | reactivate | amount
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("bank");

  const run = async (fn, message) => {
    setBusy(true);
    try { await fn(); toast.success(message || t("adm.done")); setDialog(null); reload(); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setBusy(false); }
  };

  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  if (loading || !p) return <Skeleton height={420} radius={18} />;

  const tabs = {
    bank: { rows: p.bankAccounts, cols: [
      { key: "bankName", header: t("bank.bankName"), render: (r) => <><div className="fw-600">{r.bankName}</div><div className="text-xs text-muted">{r.branchName}</div></> },
      { key: "acc", header: t("bank.number"), render: (r) => <span className="mono">{r.accountNumberMasked}</span> },
      { key: "isPrimary", header: t("bank.primary"), render: (r) => (r.isPrimary ? t("common.yes") : t("common.no")) },
      { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
    ] },
    nominees: { rows: p.nominees, cols: [
      { key: "fullName", header: t("common.name") },
      { key: "relationship", header: t("nom.relationship"), render: (r) => t(`nom.rel.${r.relationship}`) },
      { key: "share", header: t("nom.share"), align: "right", render: (r) => `${r.sharePercentage}%` },
      { key: "phone", header: t("common.phone"), render: (r) => r.phone || "—" },
    ] },
    life: { rows: p.lifeVerifications, cols: [
      { key: "submittedAt", header: t("common.date"), render: (r) => formatDateTime(r.submittedAt) },
      { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
      { key: "method", header: t("face.methodCol"), render: (r) => <MethodBadge method={r.method} /> },
      { key: "matchDistance", header: t("face.distanceCol"), align: "right", render: (r) => (r.matchDistance != null ? r.matchDistance.toFixed(3) : "—") },
      { key: "validUntil", header: t("common.to"), render: (r) => formatDate(r.validUntil) },
      { key: "reason", header: t("common.reason"), render: (r) => r.rejectionReason || "—" },
    ] },
    withdrawals: { rows: p.withdrawals, cols: [
      { key: "requestedAt", header: t("common.date"), render: (r) => formatDateTime(r.requestedAt) },
      { key: "amount", header: t("common.amount"), align: "right", render: (r) => formatMoney(r.amount) },
      { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
      { key: "reference", header: t("common.reference"), render: (r) => r.reference || "—" },
    ] },
    payments: { rows: p.payments, cols: [
      { key: "period", header: t("common.period"), render: (r) => formatPeriod(r.year, r.month) },
      { key: "amount", header: t("common.amount"), align: "right", render: (r) => formatMoney(r.amount) },
      { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
      { key: "failureReason", header: t("pay.failure"), render: (r) => r.failureReason || "—" },
    ] },
  };

  return (
    <div className="stack-lg">
      <Link to="/admin/pensioners" className="row text-sm fw-600"><ArrowLeft size={16} aria-hidden /> {t("nav.pensioners")}</Link>
      <PageHeader
        title={p.fullName}
        subtitle={`${p.pensionId} · ${p.email}`}
        actions={
          <>
            {p.status === "Active" && <Button variant="outline" icon={Pencil} onClick={() => setDialog("amount")}>{t("adm.changeAmount")}</Button>}
            {p.status === "Active" && <Button variant="danger" icon={Ban} onClick={() => setDialog("suspend")}>{t("adm.suspend")}</Button>}
            {p.status === "Suspended" && <Button variant="secondary" icon={RotateCcw} onClick={() => setDialog("reactivate")}>{t("adm.reactivate")}</Button>}
            {p.faceEnrolledAt && <Button variant="outline" icon={ScanFace} onClick={() => setDialog("resetFace")}>{t("face.reset")}</Button>}
          </>
        }
      />
      {p.statusReason && <Alert tone="warning" title={t("common.reason")}>{p.statusReason}</Alert>}

      <div className="grid grid-2">
        <Card title={t("prof.personal")} actions={<StatusBadge status={p.status} />}>
          <dl className="dl">
            <dt>{t("auth.fullNameBn")}</dt><dd>{p.fullNameBn || "—"}</dd>
            <dt>{t("auth.nid")}</dt><dd className="mono">{p.nidNumber}</dd>
            <dt>{t("auth.dob")}</dt><dd>{formatDate(p.dateOfBirth)}</dd>
            <dt>{t("auth.gender")}</dt><dd>{t(`gender.${p.gender}`)}</dd>
            <dt>{t("common.phone")}</dt><dd>{p.phone}</dd>
            <dt>{t("auth.address")}</dt><dd>{p.address}</dd>
            <dt>{t("common.date")}</dt><dd>{formatDateTime(p.createdAt)}</dd>
          </dl>
        </Card>
        <Card title={t("auth.step3")}>
          <dl className="dl">
            <dt>{t("auth.pensionType")}</dt><dd>{t(`pensionType.${p.pensionType}`)}</dd>
            <dt>{t("auth.organization")}</dt><dd>{p.formerOrganization}</dd>
            <dt>{t("auth.designation")}</dt><dd>{p.designation}</dd>
            <dt>{t("auth.employeeId")}</dt><dd>{p.employeeId || "—"}</dd>
            <dt>{t("auth.retirementDate")}</dt><dd>{formatDate(p.retirementDate)}</dd>
            <dt>{t("auth.basicSalary")}</dt><dd>{formatMoney(p.lastBasicSalary)}</dd>
            <dt>{t("dash.monthlyPension")}</dt><dd className="amount">{formatMoney(p.monthlyPensionAmount)}</dd>
            <dt>{t("common.balance")}</dt><dd className="amount">{formatMoney(p.balance)}</dd>
            <dt>{t("adm.activatedOn")}</dt><dd>{formatDateTime(p.approvedAt)}</dd>
            <dt>{t("face.enrolledCol")}</dt><dd>{p.faceEnrolledAt ? formatDateTime(p.faceEnrolledAt) : "—"}</dd>
          </dl>
        </Card>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "bank", label: t("nav.bank"), count: p.bankAccounts.length },
        { value: "nominees", label: t("nav.nominees"), count: p.nominees.length },
        { value: "life", label: t("nav.life"), count: p.lifeVerifications.length },
        { value: "withdrawals", label: t("nav.withdrawals"), count: p.withdrawals.length },
        { value: "payments", label: t("nav.adminPayments"), count: p.payments.length },
      ]} />
      <Card flush>
        <DataTable columns={tabs[tab].cols} rows={tabs[tab].rows} rowKey="id" />
      </Card>

      <AmountModal open={dialog === "amount"} pensioner={p} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />
      <ReasonDialog open={dialog === "suspend"} title={t("adm.suspend")} confirmLabel={t("adm.suspend")} label={t("common.reason")} loading={busy}
        onCancel={() => setDialog(null)} onConfirm={(reason) => run(() => adminApi.suspendPensioner(p.id, reason))} />
      <ConfirmDialog open={dialog === "resetFace"} title={t("face.reset")} message={t("face.resetMsg")} tone="danger" loading={busy}
        onCancel={() => setDialog(null)} onConfirm={() => run(() => adminApi.resetFace(p.id))} />
      <ConfirmDialog open={dialog === "reactivate"} title={t("adm.reactivate")} message={p.fullName} loading={busy}
        onCancel={() => setDialog(null)} onConfirm={() => run(() => adminApi.reactivatePensioner(p.id))} />
    </div>
  );
}
