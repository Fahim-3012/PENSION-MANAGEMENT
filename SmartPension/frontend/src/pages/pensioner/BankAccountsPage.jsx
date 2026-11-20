import { useState } from "react";
import { Landmark, Plus, Star, Trash2 } from "lucide-react";
import { bankApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import {
  Alert, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, StatusBadge,
} from "../../components/ui";
import { patterns } from "../../lib/validators";

const empty = { bankName: "", branchName: "", accountHolderName: "", accountNumber: "", routingNumber: "" };

function AddBankModal({ open, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const close = () => { if (!saving) { setForm(empty); setErrors({}); onClose(); } };

  const save = async (e) => {
    e?.preventDefault();
    const req = t("common.required");
    const v = {};
    if (form.bankName.trim().length < 2) v.bankName = req;
    if (form.branchName.trim().length < 2) v.branchName = req;
    if (form.accountHolderName.trim().length < 2) v.accountHolderName = req;
    if (!patterns.account.test(form.accountNumber.trim())) v.accountNumber = "Account number must be 8–20 digits.";
    if (form.routingNumber && !patterns.routing.test(form.routingNumber.trim())) v.routingNumber = "Routing number must be 9 digits.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await bankApi.create({ ...form, accountNumber: form.accountNumber.trim(), routingNumber: form.routingNumber.trim() || null });
      toast.success(t("bank.added"));
      setForm(empty);
      onSaved();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("bank.add")}
      closeDisabled={saving}
      footer={<><Button variant="outline" onClick={close} disabled={saving}>{t("common.cancel")}</Button><Button onClick={save} loading={saving}>{t("common.save")}</Button></>}
    >
      <form className="form-grid" onSubmit={save} noValidate>
        <Input label={t("bank.bankName")} required value={form.bankName} onChange={set("bankName")} error={errors.bankName} data-autofocus />
        <Input label={t("bank.branch")} required value={form.branchName} onChange={set("branchName")} error={errors.branchName} />
        <Input className="span-2" label={t("bank.holder")} required value={form.accountHolderName} onChange={set("accountHolderName")} error={errors.accountHolderName} />
        <Input label={t("bank.number")} required inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={set("accountNumber")} error={errors.accountNumber} />
        <Input label={`${t("bank.routing")} (${t("common.optional")})`} inputMode="numeric" value={form.routingNumber} onChange={set("routingNumber")} error={errors.routingNumber} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function BankAccountsPage() {
  const { t, formatDate } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => bankApi.list(), []);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(null);

  const makePrimary = async (id) => {
    setBusy(id);
    try { await bankApi.setPrimary(id); toast.success(t("bank.primarySet")); reload(); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy(removing.id);
    try { await bankApi.remove(removing.id); toast.success(t("bank.removed")); setRemoving(null); reload(); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setBusy(null); }
  };

  const accounts = data || [];

  return (
    <div className="stack-lg">
      <PageHeader
        title={t("bank.title")}
        subtitle={t("bank.sub")}
        actions={<Button icon={Plus} onClick={() => setAdding(true)} disabled={accounts.length >= 3}>{t("bank.add")}</Button>}
      />
      {accounts.length >= 3 && <Alert tone="info">{t("bank.limit")}</Alert>}

      {error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : loading && !data ? (
        <div className="grid grid-2"><Skeleton height={180} radius={18} /><Skeleton height={180} radius={18} /></div>
      ) : accounts.length === 0 ? (
        <Card><EmptyState icon={Landmark} title={t("bank.empty")} message={t("bank.emptyMsg")}
          action={<Button icon={Plus} onClick={() => setAdding(true)}>{t("bank.add")}</Button>} /></Card>
      ) : (
        <div className="grid grid-2">
          {accounts.map((b) => (
            <Card key={b.id} hover>
              <div className="stack">
                <div className="row-between">
                  <div className="row">
                    <span className="stat-card__icon stat-card__icon--secondary" aria-hidden><Landmark size={22} /></span>
                    <div>
                      <div className="fw-600">{b.bankName}</div>
                      <div className="text-sm text-muted">{b.branchName}</div>
                    </div>
                  </div>
                  <div className="row">
                    {b.isPrimary && <Badge tone="accent" plain><Star size={12} aria-hidden /> {t("bank.primary")}</Badge>}
                    <StatusBadge status={b.status} />
                  </div>
                </div>
                <dl className="dl">
                  <dt>{t("bank.holder")}</dt><dd>{b.accountHolderName}</dd>
                  <dt>{t("bank.number")}</dt><dd className="mono" aria-label={`ending ${b.accountNumberMasked.slice(-4)}`}>{b.accountNumberMasked}</dd>
                  {b.routingNumber && (<><dt>{t("bank.routing")}</dt><dd className="mono">{b.routingNumber}</dd></>)}
                </dl>
                {b.status === "Verified" && b.verifiedAt && <div className="text-sm text-muted">{t("bank.verifiedOn", { date: formatDate(b.verifiedAt) })}</div>}
                {b.status === "Rejected" && b.rejectionReason && <Alert tone="danger">{b.rejectionReason}</Alert>}
                <div className="row">
                  {!b.isPrimary && b.status !== "Rejected" && (
                    <Button variant="outline" size="sm" icon={Star} loading={busy === b.id} onClick={() => makePrimary(b.id)}>{t("bank.makePrimary")}</Button>
                  )}
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setRemoving(b)}>{t("common.remove")}</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddBankModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />
      <ConfirmDialog
        open={!!removing}
        title={t("bank.removeConfirm")}
        message={t("bank.removeMsg")}
        tone="danger"
        confirmLabel={t("common.remove")}
        loading={!!removing && busy === removing.id}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
