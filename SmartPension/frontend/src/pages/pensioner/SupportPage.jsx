import { useState } from "react";
import { LifeBuoy, MessageSquarePlus } from "lucide-react";
import { complaintApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, SkeletonRows, StatusBadge, Textarea } from "../../components/ui";
import { COMPLAINT_CATEGORIES } from "../../lib/format";

const blank = { category: "General", subject: "", message: "" };

export default function SupportPage() {
  const { t, formatDateTime } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => complaintApi.list(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async () => {
    const v = {};
    if (form.subject.trim().length < 5) v.subject = "At least 5 characters.";
    if (form.message.trim().length < 10) v.message = "At least 10 characters.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await complaintApi.create(form);
      toast.success(t("sup.sent"));
      setOpen(false);
      setForm(blank);
      reload();
    } catch (e) {
      setErrors(getFieldErrors(e));
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader title={t("sup.title")} subtitle={t("sup.sub")}
        actions={<Button icon={MessageSquarePlus} onClick={() => setOpen(true)}>{t("sup.new")}</Button>} />

      {error ? <Card><ErrorState error={error} onRetry={reload} /></Card>
        : loading && !data ? <Card><SkeletonRows /></Card>
        : !data?.length ? <Card><EmptyState icon={LifeBuoy} title={t("sup.empty")} action={<Button onClick={() => setOpen(true)}>{t("sup.new")}</Button>} /></Card>
        : (
          <div className="stack">
            {data.map((c) => (
              <Card key={c.id} title={c.subject} subtitle={`${t(`sup.cat.${c.category}`)} · ${formatDateTime(c.createdAt)}`} actions={<StatusBadge status={c.status} />}>
                <p style={{ whiteSpace: "pre-wrap" }}>{c.message}</p>
                {c.adminResponse && (
                  <div className="mt-4"><Alert tone="success" title={t("sup.response")}>{c.adminResponse}</Alert></div>
                )}
              </Card>
            ))}
          </div>
        )}

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={t("sup.new")} closeDisabled={saving}
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button><Button onClick={submit} loading={saving}>{t("common.submit")}</Button></>}>
        <div className="stack">
          <Select label={t("sup.category")} required value={form.category} onChange={set("category")}
            options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: t(`sup.cat.${c}`) }))} />
          <Input label={t("sup.subject")} required maxLength={150} value={form.subject} onChange={set("subject")} error={errors.subject} data-autofocus />
          <Textarea label={t("sup.message")} required rows={5} maxLength={2000} value={form.message} onChange={set("message")} error={errors.message} />
        </div>
      </Modal>
    </div>
  );
}
