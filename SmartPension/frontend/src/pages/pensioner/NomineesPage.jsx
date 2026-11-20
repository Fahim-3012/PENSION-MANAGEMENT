import { useState } from "react";
import { HeartHandshake, Pencil, Plus, Trash2 } from "lucide-react";
import { nomineeApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Button, Card, ConfirmDialog, DataTable, Input, Modal, PageHeader, Select } from "../../components/ui";
import { patterns } from "../../lib/validators";
import { RELATIONSHIPS, toInputDate } from "../../lib/format";

const blank = { fullName: "", relationship: "", nidNumber: "", phone: "", dateOfBirth: "", sharePercentage: "" };

function NomineeModal({ open, nominee, remaining, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  // Load the record being edited when the modal opens.
  const key = open ? nominee?.id ?? "new" : null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setErrors({});
    setForm(nominee ? {
      fullName: nominee.fullName, relationship: nominee.relationship, nidNumber: "", phone: nominee.phone || "",
      dateOfBirth: nominee.dateOfBirth ? toInputDate(nominee.dateOfBirth) : "", sharePercentage: String(nominee.sharePercentage),
    } : { ...blank, sharePercentage: remaining > 0 ? String(remaining) : "" });
  }

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const max = remaining + (nominee ? Number(nominee.sharePercentage) : 0);

  const save = async () => {
    const v = {};
    const req = t("common.required");
    if (form.fullName.trim().length < 3) v.fullName = req;
    if (!form.relationship) v.relationship = req;
    if (form.nidNumber && !patterns.nid.test(form.nidNumber.trim())) v.nidNumber = t("auth.nidHint");
    if (form.phone && !patterns.phone.test(form.phone.trim())) v.phone = "Enter a valid Bangladeshi mobile number.";
    const share = Number(form.sharePercentage);
    if (!share || share <= 0 || share > max) v.sharePercentage = `1 – ${max}%`;
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    const body = {
      fullName: form.fullName.trim(), relationship: form.relationship,
      // On edit, an empty NID keeps the stored value (the client only ever sees it masked).
      nidNumber: form.nidNumber.trim() || null, phone: form.phone.trim() || null,
      dateOfBirth: form.dateOfBirth || null, sharePercentage: share,
    };
    try {
      if (nominee) await nomineeApi.update(nominee.id, body);
      else await nomineeApi.create(body);
      toast.success(t("nom.saved"));
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
      onClose={() => !saving && onClose()}
      title={nominee ? t("nom.edit") : t("nom.add")}
      closeDisabled={saving}
      footer={<><Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button><Button onClick={save} loading={saving}>{t("common.save")}</Button></>}
    >
      <div className="form-grid">
        <Input className="span-2" label={t("common.name")} required value={form.fullName} onChange={set("fullName")} error={errors.fullName} data-autofocus />
        <Select label={t("nom.relationship")} required placeholder={t("auth.select")} value={form.relationship} onChange={set("relationship")} error={errors.relationship}
          options={RELATIONSHIPS.map((r) => ({ value: r, label: t(`nom.rel.${r}`) }))} />
        <Input label={t("nom.share")} type="number" min="1" max={max} step="0.01" required value={form.sharePercentage} onChange={set("sharePercentage")} error={errors.sharePercentage}
          hint={t("nom.remaining", { value: max })} />
        <Input label={`${t("nom.nid")} (${t("common.optional")})`} inputMode="numeric" value={form.nidNumber} onChange={set("nidNumber")} error={errors.nidNumber}
          hint={nominee?.nidMasked ? t("nom.nidKeep", { value: nominee.nidMasked }) : undefined} />
        <Input label={`${t("common.phone")} (${t("common.optional")})`} type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
        <Input label={`${t("nom.dob")} (${t("common.optional")})`} type="date" max={toInputDate(new Date())} value={form.dateOfBirth} onChange={set("dateOfBirth")} />
      </div>
    </Modal>
  );
}

export default function NomineesPage() {
  const { t, formatDate } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => nomineeApi.list(), []);
  const [editing, setEditing] = useState(null); // null | "new" | nominee
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = data || [];
  const total = list.reduce((s, n) => s + Number(n.sharePercentage), 0);
  const remaining = Math.max(0, Math.round((100 - total) * 100) / 100);

  const remove = async () => {
    setBusy(true);
    try { await nomineeApi.remove(removing.id); toast.success(t("nom.removed")); setRemoving(null); reload(); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const columns = [
    { key: "fullName", header: t("common.name"), sortable: true, render: (r) => <span className="fw-600">{r.fullName}</span> },
    { key: "relationship", header: t("nom.relationship"), render: (r) => t(`nom.rel.${r.relationship}`) },
    { key: "sharePercentage", header: t("nom.share"), align: "right", sortable: true, sortValue: (r) => Number(r.sharePercentage), render: (r) => `${r.sharePercentage}%` },
    { key: "nidMasked", header: t("nom.nid"), render: (r) => <span className="mono">{r.nidMasked || "—"}</span> },
    { key: "phone", header: t("common.phone"), render: (r) => r.phone || "—" },
    { key: "dateOfBirth", header: t("nom.dob"), render: (r) => formatDate(r.dateOfBirth) },
    { key: "actions", header: t("common.actions"), render: (r) => (
      <div className="row" style={{ gap: 4 }}>
        <Button variant="ghost" size="sm" iconOnly icon={Pencil} aria-label={`${t("common.edit")} ${r.fullName}`} onClick={() => setEditing(r)} />
        <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`${t("common.remove")} ${r.fullName}`} onClick={() => setRemoving(r)} />
      </div>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nom.title")} subtitle={t("nom.sub")}
        actions={<Button icon={Plus} onClick={() => setEditing("new")} disabled={remaining <= 0}>{t("nom.add")}</Button>} />

      <Card>
        <div className="row-between">
          <span className="fw-600">{t("nom.totalShare")}</span>
          <span className="amount">{total}% · <span className="text-muted">{t("nom.remaining", { value: remaining })}</span></span>
        </div>
        <div className="progress mt-2" role="progressbar" aria-valuenow={total} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.min(total, 100)}%`, background: total === 100 ? "var(--c-secondary)" : "var(--c-accent)" }} />
        </div>
      </Card>

      <Card flush>
        <DataTable columns={columns} rows={list} loading={loading} error={error} onRetry={reload}
          emptyIcon={HeartHandshake} emptyTitle={t("nom.empty")} emptyMessage={t("nom.emptyMsg")} caption={t("nom.title")} />
      </Card>

      <NomineeModal
        open={!!editing}
        nominee={editing === "new" ? null : editing}
        remaining={remaining}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />
      <ConfirmDialog
        open={!!removing}
        title={t("nom.removeConfirm", { name: removing?.fullName || "" })}
        tone="danger"
        confirmLabel={t("common.remove")}
        loading={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
