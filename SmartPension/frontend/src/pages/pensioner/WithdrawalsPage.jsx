import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, Wallet } from "lucide-react";
import { bankApi, withdrawalApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApi, useDebounced } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import {
  Alert, Button, Card, DataTable, Input, Modal, PageHeader, Pagination, Select, Skeleton, StatusBadge, Tabs, Textarea,
} from "../../components/ui";

const STATUS_TABS = ["", "Pending", "UnderReview", "Approved", "Paid", "Rejected", "Cancelled"];

function WithdrawalForm({ open, onClose, eligibility, onCreated }) {
  const { t, formatMoney } = useI18n();
  const toast = useToast();
  const banks = useApi(() => bankApi.list(), [open], { immediate: open });
  const verified = (banks.data || []).filter((b) => b.status === "Verified");
  const [stage, setStage] = useState("form");
  const [form, setForm] = useState({ amount: "", bankAccountId: "", note: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const min = eligibility?.minAmount ?? 0;
  const max = eligibility?.availableBalance ?? 0;
  const selectedBank = verified.find((b) => String(b.id) === String(form.bankAccountId)) ||
    (verified.length === 1 ? verified[0] : null);

  const reset = () => { setStage("form"); setForm({ amount: "", bankAccountId: "", note: "" }); setErrors({}); };
  const close = () => { if (!submitting) { reset(); onClose(); } };

  const review = () => {
    const e = {};
    const amount = Number(form.amount);
    if (!form.amount || Number.isNaN(amount) || amount < min || amount > max) {
      e.amount = t("wd.amountInvalid", { min: formatMoney(min), max: formatMoney(max) });
    }
    if (!selectedBank) e.bankAccountId = t("wd.selectAccount");
    setErrors(e);
    if (!Object.keys(e).length) setStage("confirm");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const created = await withdrawalApi.create({
        amount: Number(form.amount), bankAccountId: selectedBank.id, note: form.note.trim() || null,
      });
      toast.success(t("wd.submitted"));
      reset();
      onCreated(created);
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
      setStage("form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={stage === "form" ? t("wd.new") : t("wd.reviewStep")}
      closeDisabled={submitting}
      footer={
        stage === "form" ? (
          <>
            <Button variant="outline" onClick={close}>{t("common.cancel")}</Button>
            <Button onClick={review} disabled={banks.loading}>{t("common.next")}</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStage("form")} disabled={submitting}>{t("common.back")}</Button>
            <Button variant="secondary" icon={CheckCircle2} onClick={submit} loading={submitting}>{t("common.confirm")}</Button>
          </>
        )
      }
    >
      {stage === "form" ? (
        <div className="stack">
          <div className="row-between text-sm">
            <span className="text-muted">{t("wd.min", { amount: formatMoney(min) })}</span>
            <span className="fw-600">{t("wd.max", { amount: formatMoney(max) })}</span>
          </div>
          <Input
            label={t("wd.amount")}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => { setForm((f) => ({ ...f, amount: e.target.value })); setErrors((x) => ({ ...x, amount: undefined })); }}
            error={errors.amount}
            data-autofocus
          />
          <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, amount: String(max) }))} style={{ alignSelf: "flex-start" }}>
            {t("wd.useMax")}
          </Button>
          {banks.loading ? (
            <Skeleton height={46} />
          ) : (
            <Select
              label={t("wd.toAccount")}
              required
              placeholder={verified.length === 1 ? undefined : t("auth.select")}
              value={selectedBank ? String(selectedBank.id) : form.bankAccountId}
              onChange={(e) => { setForm((f) => ({ ...f, bankAccountId: e.target.value })); setErrors((x) => ({ ...x, bankAccountId: undefined })); }}
              options={verified.map((b) => ({ value: String(b.id), label: `${b.bankName} — ${b.accountNumberMasked}${b.isPrimary ? ` (${t("bank.primary")})` : ""}` }))}
              error={errors.bankAccountId}
            />
          )}
          <Textarea
            label={`${t("wd.note")} (${t("common.optional")})`}
            rows={2}
            maxLength={300}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      ) : (
        <div className="stack">
          <div className="text-center">
            <div className="text-muted text-sm">{t("wd.amount")}</div>
            <div className="hero__amount" style={{ color: "var(--c-primary)" }}>{formatMoney(form.amount)}</div>
          </div>
          <dl className="dl">
            <dt>{t("wd.toAccount")}</dt><dd>{selectedBank?.bankName} — {selectedBank?.accountNumberMasked}</dd>
            <dt>{t("bank.holder")}</dt><dd>{selectedBank?.accountHolderName}</dd>
            <dt>{t("common.balance")}</dt><dd>{formatMoney(max)} → {formatMoney(max - Number(form.amount))}</dd>
            {form.note && (<><dt>{t("common.note")}</dt><dd>{form.note}</dd></>)}
          </dl>
          <Alert tone="info">{t("wd.confirmMsg")}</Alert>
        </div>
      )}
    </Modal>
  );
}

export default function WithdrawalsPage() {
  const { t, formatMoney, formatDate, formatDateTime } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const q = useDebounced(search);
  const pageSize = 10;

  const eligibility = useApi(() => withdrawalApi.eligibility(), []);
  const list = useApi(() => withdrawalApi.list({ page, pageSize, status, search: q }), [page, status, q]);

  const el = eligibility.data;
  const columns = useMemo(() => [
    { key: "id", header: "#", render: (r) => `#${r.id}` },
    { key: "requestedAt", header: t("common.date"), render: (r) => formatDateTime(r.requestedAt) },
    { key: "amount", header: t("common.amount"), align: "right", render: (r) => <span className="amount">{formatMoney(r.amount)}</span> },
    { key: "bank", header: t("common.bank"), render: (r) => `${r.bankName} ${r.accountNumberMasked}` },
    { key: "reference", header: t("common.reference"), render: (r) => r.reference || "—" },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
  ], [t, formatMoney, formatDateTime]);

  return (
    <div className="stack-lg">
      <PageHeader
        title={t("wd.title")}
        subtitle={t("wd.sub")}
        actions={<Button icon={Plus} onClick={() => setFormOpen(true)} disabled={!el?.eligible}>{t("wd.new")}</Button>}
      />

      {eligibility.loading ? (
        <Skeleton height={90} radius={14} />
      ) : el && !el.eligible ? (
        <Alert tone="warning" title={t("wd.notEligibleTitle")}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {el.reasons.map((r) => <li key={r}>{t(`elig.${r}`)}</li>)}
          </ul>
          {el.nextEligibleDate && <div className="mt-2 fw-600">{t("wd.nextDate", { date: formatDate(el.nextEligibleDate) })}</div>}
        </Alert>
      ) : el ? (
        <Alert tone="success" title={t("dash.eligibleNow")}>
          {t("dash.upTo", { amount: formatMoney(el.availableBalance) })} · {t("wd.min", { amount: formatMoney(el.minAmount) })}
        </Alert>
      ) : null}

      <Card flush>
        <div className="toolbar">
          <Tabs
            label={t("common.status")}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            tabs={STATUS_TABS.map((s) => ({ value: s, label: s ? t(`status.${s}`) : t("common.all") }))}
          />
          <Input
            className="search"
            type="search"
            aria-label={t("common.search")}
            placeholder={t("pay.searchPh")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          onRowClick={(r) => navigate(`/app/withdrawals/${r.id}`)}
          emptyIcon={Wallet}
          emptyTitle={t("wd.empty")}
          emptyMessage={t("wd.emptyMsg")}
          caption={t("wd.title")}
        />
        <Pagination page={page} pageSize={pageSize} total={list.data?.total} onChange={setPage} />
      </Card>

      <WithdrawalForm
        open={formOpen}
        eligibility={el}
        onClose={() => setFormOpen(false)}
        onCreated={(w) => { setFormOpen(false); eligibility.reload(); list.reload(); navigate(`/app/withdrawals/${w.id}`); }}
      />
    </div>
  );
}
