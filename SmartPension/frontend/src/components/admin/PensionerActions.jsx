import { useEffect, useState } from "react";
import { adminApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Button, Input, Modal, Textarea } from "../ui";

/** Change an active pensioner's monthly pension (reason is audited). */
export function AmountModal({ open, pensioner, onClose, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setForm({ amount: String(pensioner?.monthlyPensionAmount ?? ""), reason: "" }); setErrors({}); } }, [open, pensioner]);

  const submit = async () => {
    const v = {};
    if (!Number(form.amount) || Number(form.amount) <= 0) v.amount = t("common.required");
    if (form.reason.trim().length < 5) v.reason = t("adm.reasonRequired");
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await adminApi.updatePensionAmount(pensioner.id, { monthlyPensionAmount: Number(form.amount), reason: form.reason.trim() });
      toast.success(t("adm.done"));
      onDone();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("adm.changeAmount")} closeDisabled={saving}
      footer={<><Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button><Button onClick={submit} loading={saving}>{t("common.save")}</Button></>}>
      <div className="stack">
        <Input label={t("adm.monthlyAmount")} type="number" min="1" step="0.01" required value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} error={errors.amount} data-autofocus />
        <Textarea label={t("common.reason")} required rows={3} value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} error={errors.reason} />
      </div>
    </Modal>
  );
}
