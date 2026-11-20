import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, XCircle } from "lucide-react";
import { withdrawalApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, ConfirmDialog, ErrorState, PageHeader, Skeleton, StatusBadge } from "../../components/ui";
import { WithdrawalTimeline } from "../../components/pension/PensionWidgets";

export default function WithdrawalDetailPage() {
  const { id } = useParams();
  const { t, formatMoney, formatDateTime } = useI18n();
  const toast = useToast();
  const { data: w, loading, error, reload, setData } = useApi(() => withdrawalApi.get(id), [id]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      setData(await withdrawalApi.cancel(id));
      toast.success(t("wd.cancelled"));
      setConfirm(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <Link to="/app/withdrawals" className="row text-sm fw-600"><ArrowLeft size={16} aria-hidden /> {t("wd.backToList")}</Link>
      {error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : loading || !w ? (
        <Skeleton height={320} radius={18} />
      ) : (
        <>
          <PageHeader
            title={t("wd.detail", { id: w.id })}
            subtitle={t("wd.requestedOn", { date: formatDateTime(w.requestedAt) })}
            actions={w.status === "Pending" && (
              <Button variant="outline" icon={XCircle} onClick={() => setConfirm(true)}>{t("wd.cancel")}</Button>
            )}
          />
          <div className="grid grid-2">
            <Card title={t("common.details")} actions={<StatusBadge status={w.status} />}>
              <dl className="dl">
                <dt>{t("common.amount")}</dt><dd className="amount">{formatMoney(w.amount)}</dd>
                <dt>{t("wd.toAccount")}</dt><dd>{w.bankName} {w.accountNumberMasked}</dd>
                <dt>{t("common.reference")}</dt><dd>{w.reference || "—"}</dd>
                {w.note && (<><dt>{t("common.note")}</dt><dd>{w.note}</dd></>)}
              </dl>
              {w.status === "Rejected" && w.rejectionReason && (
                <div className="mt-4"><Alert tone="danger" title={t("common.reason")}>{w.rejectionReason}</Alert></div>
              )}
            </Card>
            <Card title={t("wd.timeline")}>
              <WithdrawalTimeline withdrawal={w} />
            </Card>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title={t("wd.cancelConfirm")}
        tone="danger"
        confirmLabel={t("wd.cancel")}
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
