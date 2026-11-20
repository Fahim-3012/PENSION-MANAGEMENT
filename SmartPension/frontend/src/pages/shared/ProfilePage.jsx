import { useEffect, useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { authApi, pensionerApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, ErrorState, Input, PageHeader, PasswordInput, Segmented, Skeleton, StatusBadge, Textarea } from "../../components/ui";
import { patterns, validatePassword } from "../../lib/validators";

function PensionerDetails() {
  const { t, formatDate, formatMoney } = useI18n();
  const toast = useToast();
  const { data: p, loading, error, reload, setData } = useApi(() => pensionerApi.profile(), []);
  const [form, setForm] = useState({ phone: "", address: "", fullNameBn: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (p) setForm({ phone: p.phone, address: p.address, fullNameBn: p.fullNameBn || "" }); }, [p]);

  const save = async (e) => {
    e.preventDefault();
    const v = {};
    if (!patterns.phone.test(form.phone.trim())) v.phone = "Enter a valid Bangladeshi mobile number.";
    if (form.address.trim().length < 5) v.address = t("common.required");
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try { setData(await pensionerApi.updateProfile(form)); toast.success(t("prof.updated")); }
    catch (err) { setErrors(getFieldErrors(err)); toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  if (loading || !p) return <Skeleton height={300} radius={18} />;

  return (
    <div className="grid grid-2">
      <Card title={t("prof.personal")} actions={<StatusBadge status={p.status} />}>
        <dl className="dl">
          <dt>{t("common.pensionId")}</dt><dd>{p.pensionId || "—"}</dd>
          <dt>{t("auth.fullName")}</dt><dd>{p.fullName}</dd>
          <dt>{t("auth.nid")}</dt><dd className="mono">{p.nidMasked}</dd>
          <dt>{t("auth.dob")}</dt><dd>{formatDate(p.dateOfBirth)}</dd>
          <dt>{t("auth.gender")}</dt><dd>{t(`gender.${p.gender}`)}</dd>
          <dt>{t("auth.pensionType")}</dt><dd>{t(`pensionType.${p.pensionType}`)}</dd>
          <dt>{t("auth.organization")}</dt><dd>{p.formerOrganization}</dd>
          <dt>{t("auth.designation")}</dt><dd>{p.designation}</dd>
          <dt>{t("auth.retirementDate")}</dt><dd>{formatDate(p.retirementDate)}</dd>
          <dt>{t("dash.monthlyPension")}</dt><dd>{formatMoney(p.monthlyPensionAmount)}</dd>
        </dl>
        <p className="text-sm text-muted mt-4">{t("prof.readOnlyNote")}</p>
      </Card>
      <Card title={t("prof.contact")}>
        <form className="stack" onSubmit={save} noValidate>
          <Input label={t("common.email")} value={p.email} disabled />
          <Input label={t("auth.mobile")} type="tel" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={errors.phone} />
          <Input label={t("auth.fullNameBn")} value={form.fullNameBn} onChange={(e) => setForm((f) => ({ ...f, fullNameBn: e.target.value }))} lang="bn" />
          <Textarea label={t("auth.address")} required rows={3} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} error={errors.address} />
          <Button type="submit" icon={Save} loading={saving} style={{ alignSelf: "flex-start" }}>{t("common.save")}</Button>
        </form>
      </Card>
    </div>
  );
}

function ChangePassword() {
  const { t } = useI18n();
  const toast = useToast();
  const blank = { currentPassword: "", newPassword: "", confirmPassword: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!form.currentPassword) v.currentPassword = t("common.required");
    const pw = validatePassword(form.newPassword);
    if (pw) v.newPassword = pw;
    if (form.confirmPassword !== form.newPassword) v.confirmPassword = "Passwords do not match.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try { await authApi.changePassword(form); toast.success(t("prof.pwChanged")); setForm(blank); }
    catch (err) { setErrors(getFieldErrors(err)); toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Card title={t("prof.security")}>
      <form className="stack" onSubmit={submit} noValidate style={{ maxWidth: 460 }}>
        <PasswordInput label={t("prof.current")} required autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} />
        <PasswordInput label={t("prof.new")} required autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} error={errors.newPassword} hint={t("auth.passwordHint")} />
        <PasswordInput label={t("auth.confirmPassword")} required autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <Button type="submit" icon={KeyRound} loading={saving} style={{ alignSelf: "flex-start" }}>{t("prof.security")}</Button>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const { t, lang, update, fontSize, formatDateTime } = useI18n();
  const { user, isPensioner } = useAuth();
  const toast = useToast();

  const setLang = async (v) => {
    update({ lang: v });
    try { await authApi.setLanguage(v); } catch (e) { toast.error(getErrorMessage(e)); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title={t("prof.title")} subtitle={user?.email} />
      {isPensioner ? <PensionerDetails /> : (
        <Card title={t("prof.personal")}>
          <dl className="dl">
            <dt>{t("common.name")}</dt><dd>{user?.fullName}</dd>
            <dt>{t("common.email")}</dt><dd>{user?.email}</dd>
            <dt>{t("adm.role")}</dt><dd>{user?.roles.map((r) => t(`role.${r}`)).join(", ")}</dd>
            <dt>{t("prof.lastLogin")}</dt><dd>{formatDateTime(user?.lastLoginAt)}</dd>
          </dl>
        </Card>
      )}
      <div className="grid grid-2">
        <ChangePassword />
        <Card title={t("prof.preferences")}>
          <div className="stack">
            <div className="stack-sm">
              <span className="field__label">{t("prof.language")}</span>
              <Segmented label={t("prof.language")} value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
            </div>
            <div className="stack-sm">
              <span className="field__label">{t("top.fontSize")}</span>
              <Segmented label={t("top.fontSize")} value={fontSize} onChange={(v) => update({ fontSize: v })}
                options={[{ value: "normal", label: "A" }, { value: "large", label: "A+" }, { value: "xlarge", label: "A++" }]} />
            </div>
            <Alert tone="info">{t("auth.secure")}</Alert>
          </div>
        </Card>
      </div>
    </div>
  );
}
