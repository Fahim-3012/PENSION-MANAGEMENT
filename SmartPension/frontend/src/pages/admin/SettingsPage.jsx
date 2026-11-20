import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { adminApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, ErrorState, Input, PageHeader, SkeletonRows } from "../../components/ui";

export default function SettingsPage() {
  const { t, formatDateTime } = useI18n();
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(() => adminApi.settings(), []);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setValues(Object.fromEntries(data.map((s) => [s.key, s.value]))); }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      setData(await adminApi.updateSettings(values));
      toast.success(t("adm.settingsSaved"));
    } catch (err) {
      // Setting keys are PascalCase; keep the raw keys for matching.
      const raw = err?.response?.data?.errors || {};
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v[0]])));
      if (!Object.keys(getFieldErrors(err)).length) toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.settings")} />
      {!isSuperAdmin && <Alert tone="info">{t("adm.superOnly")}</Alert>}
      <Card>
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <SkeletonRows rows={6} cols={2} /> : (
          <form className="stack" onSubmit={save} noValidate>
            <div className="form-grid">
              {data.map((s) => (
                <Input
                  key={s.key}
                  label={s.key.replace(/([A-Z])/g, " $1").trim()}
                  hint={`${s.description || ""} · ${formatDateTime(s.updatedAt)}`}
                  value={values[s.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                  error={errors[s.key]}
                  disabled={!isSuperAdmin}
                />
              ))}
            </div>
            {isSuperAdmin && <Button type="submit" icon={Save} loading={saving} style={{ alignSelf: "flex-start" }}>{t("common.save")}</Button>}
          </form>
        )}
      </Card>
    </div>
  );
}
