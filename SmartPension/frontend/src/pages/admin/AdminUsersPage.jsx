import { useState } from "react";
import { UserCog, UserPlus } from "lucide-react";
import { adminApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, ConfirmDialog, DataTable, Input, Modal, PageHeader, PasswordInput, Select } from "../../components/ui";
import { patterns, validatePassword } from "../../lib/validators";

const blank = { fullName: "", email: "", password: "", role: "Admin" };

export default function AdminUsersPage() {
  const { t, formatDateTime } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const list = useApi(() => adminApi.users(), []);
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const create = async () => {
    const v = {};
    if (form.fullName.trim().length < 3) v.fullName = t("common.required");
    if (!patterns.email.test(form.email.trim())) v.email = "Enter a valid email address.";
    const pw = validatePassword(form.password);
    if (pw) v.password = pw;
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try { await adminApi.createUser(form); toast.success(t("adm.adminCreated")); setOpen(false); setForm(blank); list.reload(); }
    catch (e) { setErrors(getFieldErrors(e)); toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: "fullName", header: t("common.name"), render: (r) => <><div className="fw-600">{r.fullName}</div><div className="text-xs text-muted">{r.email}</div></> },
    { key: "roles", header: t("adm.role"), render: (r) => <div className="row" style={{ gap: 4 }}>{r.roles.map((x) => <Badge key={x} tone={x === "SuperAdmin" ? "accent" : "info"} plain>{t(`role.${x}`)}</Badge>)}</div> },
    { key: "isActive", header: t("common.status"), render: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? t("status.Active") : t("status.Suspended")}</Badge> },
    { key: "lastLoginAt", header: t("adm.lastLogin"), render: (r) => formatDateTime(r.lastLoginAt) },
    { key: "actions", header: t("common.actions"), render: (r) => r.id !== user?.id && (
      <Button size="sm" variant="outline" onClick={() => setToggling(r)}>{r.isActive ? t("adm.deactivate") : t("adm.activate")}</Button>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.users")} actions={<Button icon={UserPlus} onClick={() => setOpen(true)}>{t("adm.addAdmin")}</Button>} />
      <Card flush>
        <DataTable columns={columns} rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} emptyIcon={UserCog} />
      </Card>
      <Modal open={open} onClose={() => !saving && setOpen(false)} title={t("adm.addAdmin")} closeDisabled={saving}
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button><Button onClick={create} loading={saving}>{t("common.save")}</Button></>}>
        <div className="stack">
          <Input label={t("common.name")} required value={form.fullName} onChange={set("fullName")} error={errors.fullName} data-autofocus />
          <Input label={t("common.email")} type="email" required value={form.email} onChange={set("email")} error={errors.email} />
          <PasswordInput label={t("auth.password")} required autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint={t("auth.passwordHint")} />
          <Select label={t("adm.role")} value={form.role} onChange={set("role")}
            options={[{ value: "Admin", label: t("role.Admin") }, { value: "SuperAdmin", label: t("role.SuperAdmin") }]} />
        </div>
      </Modal>
      <ConfirmDialog open={!!toggling} title={toggling?.isActive ? t("adm.deactivate") : t("adm.activate")} message={toggling?.email}
        tone={toggling?.isActive ? "danger" : "secondary"} loading={busy} onCancel={() => setToggling(null)}
        onConfirm={() => run(() => adminApi.toggleUser(toggling.id), { onSuccess: () => { setToggling(null); list.reload(); } })} />
    </div>
  );
}
