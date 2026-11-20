import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Database, Download, FileCheck2, FileUp, Pencil, Plus, Power, UserCheck, UserX } from "lucide-react";
import { adminApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useAction } from "../../hooks/useAction";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import {
  Alert, Badge, Button, Card, ConfirmDialog, DataTable, Input, Modal, PageHeader, Pagination, Select, StatCard, Tabs,
} from "../../components/ui";
import { GENDERS, PENSION_TYPES, toInputDate } from "../../lib/format";

const blank = {
  pensionId: "", fullName: "", fullNameBn: "", nidNumber: "", dateOfBirth: "", gender: "", pensionType: "",
  formerOrganization: "", designation: "", employeeId: "", retirementDate: "", lastBasicSalary: "", monthlyPensionAmount: "", phone: "",
};

function RecordModal({ open, record, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);
  const claimed = !!record?.claimedByPensionerId;

  const key = open ? record?.id ?? "new" : null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setError("");
    setForm(record ? {
      pensionId: record.pensionId, fullName: record.fullName, fullNameBn: record.fullNameBn || "", nidNumber: record.nidNumber,
      dateOfBirth: toInputDate(record.dateOfBirth), gender: record.gender, pensionType: record.pensionType,
      formerOrganization: record.formerOrganization, designation: record.designation, employeeId: record.employeeId || "",
      retirementDate: toInputDate(record.retirementDate), lastBasicSalary: String(record.lastBasicSalary ?? ""),
      monthlyPensionAmount: String(record.monthlyPensionAmount), phone: record.phone || "",
    } : blank);
  }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); };

  const save = async () => {
    setSaving(true);
    try {
      if (record) await adminApi.updateRecord(record.id, form);
      else await adminApi.createRecord(form);
      toast.success(t("reg.saved"));
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={record ? t("reg.edit") : t("reg.add")} size="lg" closeDisabled={saving}
      footer={<><Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button><Button onClick={save} loading={saving}>{t("common.save")}</Button></>}>
      <div className="stack">
        {error && <Alert tone="danger">{error}</Alert>}
        {claimed && <Alert tone="info">{t("reg.claimedNote")}</Alert>}
        <div className="form-grid">
          <Input label={t("common.pensionId")} required value={form.pensionId} onChange={set("pensionId")} disabled={!!record} data-autofocus />
          <Input label={t("auth.nid")} required inputMode="numeric" value={form.nidNumber} onChange={set("nidNumber")} disabled={claimed} />
          <Input label={t("auth.fullName")} required value={form.fullName} onChange={set("fullName")} disabled={claimed} />
          <Input label={t("auth.fullNameBn")} value={form.fullNameBn} onChange={set("fullNameBn")} lang="bn" />
          <Input label={t("auth.dob")} type="date" required value={form.dateOfBirth} onChange={set("dateOfBirth")} disabled={claimed} />
          <Select label={t("auth.gender")} required placeholder={t("auth.select")} value={form.gender} onChange={set("gender")}
            options={GENDERS.map((g) => ({ value: g, label: t(`gender.${g}`) }))} />
          <Select label={t("auth.pensionType")} required placeholder={t("auth.select")} value={form.pensionType} onChange={set("pensionType")}
            options={PENSION_TYPES.map((p) => ({ value: p, label: t(`pensionType.${p}`) }))} />
          <Input label={t("auth.retirementDate")} type="date" required value={form.retirementDate} onChange={set("retirementDate")} />
          <Input label={t("auth.organization")} required value={form.formerOrganization} onChange={set("formerOrganization")} />
          <Input label={t("auth.designation")} required value={form.designation} onChange={set("designation")} />
          <Input label={t("adm.monthlyAmount")} type="number" min="1" step="0.01" required value={form.monthlyPensionAmount} onChange={set("monthlyPensionAmount")} />
          <Input label={`${t("auth.basicSalary")} (${t("common.optional")})`} type="number" min="0" step="0.01" value={form.lastBasicSalary} onChange={set("lastBasicSalary")} />
          <Input label={`${t("auth.employeeId")} (${t("common.optional")})`} value={form.employeeId} onChange={set("employeeId")} />
          <Input label={`${t("common.phone")} (${t("common.optional")})`} type="tel" value={form.phone} onChange={set("phone")} />
        </div>
      </div>
    </Modal>
  );
}

function ImportCard({ onImported }) {
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null); // "check" | "import" | "template"
  const [confirm, setConfirm] = useState(false);

  const run = async (dryRun) => {
    setBusy(dryRun ? "check" : "import");
    try {
      const res = await adminApi.importRegistry(file, dryRun);
      setResult(res);
      if (!dryRun) {
        toast.success(t("reg.imported", { created: formatNumber(res.created), updated: formatNumber(res.updated) }));
        onImported();
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
      setConfirm(false);
    }
  };

  const template = async () => {
    setBusy("template");
    try { await adminApi.registryTemplate(); } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <Card title={t("reg.importTitle")} subtitle={t("reg.importSub")}
      actions={<Button variant="ghost" size="sm" icon={Download} loading={busy === "template"} onClick={template}>{t("reg.template")}</Button>}>
      <div className="stack">
        <div className="row">
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); e.target.value = ""; }} />
          <Button variant="outline" icon={FileUp} onClick={() => fileRef.current?.click()} disabled={!!busy}>{t("reg.chooseFile")}</Button>
          <span className="text-sm text-muted">{file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB` : t("reg.noFile")}</span>
        </div>
        <div className="row">
          <Button variant="secondary" icon={FileCheck2} disabled={!file || !!busy} loading={busy === "check"} onClick={() => run(true)}>{t("reg.check")}</Button>
          <Button icon={Database} disabled={!file || !!busy} loading={busy === "import"} onClick={() => setConfirm(true)}>{t("reg.import")}</Button>
        </div>
        <p className="text-xs text-muted">{t("reg.columns")}</p>

        {result && (
          <div className="stack-sm">
            <Alert tone={result.withErrors ? "warning" : "success"} title={result.dryRun ? t("reg.checkResult") : t("reg.importResult")}>
              {t("reg.summary", {
                rows: formatNumber(result.rows), created: formatNumber(result.created), updated: formatNumber(result.updated),
                unchanged: formatNumber(result.unchanged), errors: formatNumber(result.withErrors),
              })}
              {result.dryRun && !result.withErrors && <div className="mt-2">{t("reg.readyToImport")}</div>}
            </Alert>
            {result.errors.length > 0 && (
              <div className="card" style={{ maxHeight: 280, overflow: "auto" }}>
                <DataTable
                  rowKey={(r) => `${r.line}-${r.pensionId}`}
                  rows={result.errors}
                  columns={[
                    { key: "line", header: t("reg.line"), align: "right" },
                    { key: "pensionId", header: t("common.pensionId"), render: (r) => r.pensionId || "—" },
                    { key: "message", header: t("reg.problem") },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm} title={t("reg.import")} message={t("reg.importConfirm", { name: file?.name || "" })}
        loading={busy === "import"} onCancel={() => setConfirm(false)} onConfirm={() => run(false)} />
    </Card>
  );
}

export default function RegistryPage() {
  const { t, formatMoney, formatDate, formatNumber, formatDateTime } = useI18n();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [pensionType, setPensionType] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "", desc: true });
  const [editing, setEditing] = useState(null); // null | "new" | record
  const [toggling, setToggling] = useState(null);
  const q = useDebounced(search);
  const pageSize = 20;
  const stats = useApi(() => adminApi.registryStats(), []);
  const list = useApi(() => adminApi.registry({ page, pageSize, status, search: q, pensionType, sortBy: sort.key, sortDesc: sort.desc }),
    [page, status, q, pensionType, sort.key, sort.desc]);
  const { busy, run } = useAction();
  const refresh = () => { stats.reload(); list.reload(); };
  const s = stats.data;

  const onSort = (key) => {
    const map = { fullName: "name", monthlyPensionAmount: "amount", pensionId: "pensionId" };
    const k = map[key];
    setSort((cur) => (cur.key === k ? { key: k, desc: !cur.desc } : { key: k, desc: false }));
    setPage(1);
  };
  const shownSort = useMemo(() => {
    const back = { name: "fullName", amount: "monthlyPensionAmount", pensionId: "pensionId" };
    return sort.key ? { key: back[sort.key], desc: sort.desc } : null;
  }, [sort]);

  const columns = [
    { key: "pensionId", header: t("common.pensionId"), sortable: true, render: (r) => <span className="mono fw-600">{r.pensionId}</span> },
    { key: "fullName", header: t("common.name"), sortable: true, render: (r) => <><div className="fw-600">{r.fullName}</div><div className="text-xs text-muted mono">NID {r.nidNumber}</div></> },
    { key: "dateOfBirth", header: t("auth.dob"), render: (r) => formatDate(r.dateOfBirth) },
    { key: "pensionType", header: t("common.type"), render: (r) => <><div>{t(`pensionType.${r.pensionType}`)}</div><div className="text-xs text-muted">{r.formerOrganization}</div></> },
    { key: "monthlyPensionAmount", header: t("dash.monthlyPension"), sortable: true, align: "right", render: (r) => formatMoney(r.monthlyPensionAmount) },
    { key: "state", header: t("common.status"), render: (r) => !r.isActive ? <Badge tone="neutral">{t("reg.inactive")}</Badge>
      : r.claimedByPensionerId ? <><Badge tone="success">{t("reg.claimed")}</Badge><div className="text-xs text-muted">{formatDateTime(r.claimedAt)}</div></>
      : <Badge tone="warning">{t("reg.unclaimed")}</Badge> },
    { key: "actions", header: t("common.actions"), render: (r) => (
      <div className="row" style={{ gap: 4 }}>
        {r.claimedByPensionerId && <Link to={`/admin/pensioners/${r.claimedByPensionerId}`} className="btn btn--ghost btn--sm">{t("common.view")}</Link>}
        <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`${t("common.edit")} ${r.pensionId}`} onClick={() => setEditing(r)} />
        <Button size="sm" variant="ghost" iconOnly icon={Power} aria-label={`${r.isActive ? t("adm.deactivate") : t("adm.activate")} ${r.pensionId}`} onClick={() => setToggling(r)} />
      </div>
    ) },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("reg.title")} subtitle={t("reg.sub")}
        actions={<Button icon={Plus} onClick={() => setEditing("new")}>{t("reg.add")}</Button>} />

      <div className="grid grid-4">
        <StatCard index={0} label={t("reg.total")} value={s ? formatNumber(s.total) : "—"} loading={!s} icon={Database}
          hint={s?.lastImportAt ? t("reg.lastImport", { date: formatDateTime(s.lastImportAt) }) : undefined} />
        <StatCard index={1} label={t("reg.claimed")} value={s ? formatNumber(s.claimed) : "—"} loading={!s} icon={UserCheck} tone="secondary" />
        <StatCard index={2} label={t("reg.unclaimed")} value={s ? formatNumber(s.unclaimed) : "—"} loading={!s} icon={CheckCircle2} tone="accent" />
        <StatCard index={3} label={t("reg.inactive")} value={s ? formatNumber(s.inactive) : "—"} loading={!s} icon={UserX} tone="danger" />
      </div>

      <ImportCard onImported={() => { setPage(1); refresh(); }} />

      <Card flush>
        <div className="toolbar">
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
            { value: "", label: t("common.all") },
            { value: "unclaimed", label: t("reg.unclaimed") },
            { value: "claimed", label: t("reg.claimed") },
            { value: "inactive", label: t("reg.inactive") },
          ]} />
          <Input className="search" type="search" aria-label={t("common.search")} placeholder={t("reg.searchPh")} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select aria-label={t("common.type")} value={pensionType} onChange={(e) => { setPensionType(e.target.value); setPage(1); }} placeholder={t("common.all")}
            options={PENSION_TYPES.map((p) => ({ value: p, label: t(`pensionType.${p}`) }))} />
        </div>
        <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload}
          sort={shownSort} onSort={onSort} emptyIcon={Database} emptyTitle={t("reg.empty")} emptyMessage={t("reg.emptyMsg")} />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>

      <RecordModal open={!!editing} record={editing === "new" ? null : editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); refresh(); }} />
      <ConfirmDialog open={!!toggling} title={toggling?.isActive ? t("adm.deactivate") : t("adm.activate")}
        message={toggling && `${toggling.pensionId} — ${toggling.fullName}. ${toggling.isActive ? t("reg.deactivateNote") : ""}`}
        tone={toggling?.isActive ? "danger" : "secondary"} loading={busy} onCancel={() => setToggling(null)}
        onConfirm={() => run(() => adminApi.toggleRecord(toggling.id), { onSuccess: () => { setToggling(null); refresh(); } })} />
    </div>
  );
}
