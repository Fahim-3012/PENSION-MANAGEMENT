import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, BadgeCheck, Search, Send } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Checkbox, Input, PasswordInput, Stepper, Textarea } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { authApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { patterns, validatePassword } from "../../lib/validators";
import { toInputDate } from "../../lib/format";

const initial = {
  pensionId: "", nidNumber: "", dateOfBirth: "",
  email: "", phone: "", password: "", confirmPassword: "",
  address: "", fullNameBn: "",
  addBank: true, bankName: "", branchName: "", accountHolderName: "", accountNumber: "", routingNumber: "",
  agree: false,
};

const STEP_FIELDS = [
  ["pensionId", "nidNumber", "dateOfBirth"],
  ["email", "phone", "password", "confirmPassword"],
  ["address", "fullNameBn", "bankName", "branchName", "accountHolderName", "accountNumber", "routingNumber"],
  ["agree", "acceptedTerms"],
];

/**
 * Sign-up without admin approval: the person proves they are on the office's master list
 * (Pension ID + NID + date of birth). The pension details come from that record, and the account is active at once.
 */
export default function RegisterPage() {
  const { t, formatMoney, formatDate } = useI18n();
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [record, setRecord] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const today = toInputDate(new Date());

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
    // Changing any identity detail invalidates the match.
    if (STEP_FIELDS[0].includes(k)) setRecord(null);
  };

  const validateStep = (s) => {
    const f = form;
    const req = t("common.required");
    const e = {};
    if (s === 0) {
      if (!/^[A-Za-z0-9-]{4,30}$/.test(f.pensionId.trim())) e.pensionId = t("auth.pensionIdHint");
      if (!patterns.nid.test(f.nidNumber.trim())) e.nidNumber = t("auth.nidHint");
      if (!f.dateOfBirth) e.dateOfBirth = req;
    }
    if (s === 1) {
      if (!patterns.email.test(f.email.trim())) e.email = "Enter a valid email address.";
      if (!patterns.phone.test(f.phone.trim())) e.phone = "Enter a valid Bangladeshi mobile number (e.g. 01712345678).";
      const pw = validatePassword(f.password);
      if (pw) e.password = pw;
      if (f.confirmPassword !== f.password) e.confirmPassword = "Passwords do not match.";
    }
    if (s === 2) {
      if (f.address.trim().length < 5) e.address = req;
      if (f.addBank) {
        if (f.bankName.trim().length < 2) e.bankName = req;
        if (f.branchName.trim().length < 2) e.branchName = req;
        if (f.accountHolderName.trim().length < 2) e.accountHolderName = req;
        if (!patterns.account.test(f.accountNumber.trim())) e.accountNumber = "Account number must be 8–20 digits.";
        if (f.routingNumber && !patterns.routing.test(f.routingNumber.trim())) e.routingNumber = "Routing number must be 9 digits.";
      }
    }
    if (s === 3 && !f.agree) e.agree = req;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const identity = () => ({ pensionId: form.pensionId.trim(), nidNumber: form.nidNumber.trim(), dateOfBirth: form.dateOfBirth });

  const verify = async () => {
    if (!validateStep(0)) return;
    setLoading(true);
    setFormError("");
    try {
      const rec = await authApi.verifyRecord(identity());
      setRecord(rec);
      setForm((f) => ({
        ...f,
        fullNameBn: f.fullNameBn || rec.fullNameBn || "",
        accountHolderName: f.accountHolderName || rec.fullName,
      }));
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === 0 && !record) return verify();
    if (validateStep(step)) setStep((s) => s + 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step < 3) return next();
    if (!validateStep(3)) return;
    setLoading(true);
    setFormError("");
    const f = form;
    try {
      await register({
        ...identity(),
        email: f.email.trim(), phone: f.phone.trim(), password: f.password, confirmPassword: f.confirmPassword,
        address: f.address.trim(), fullNameBn: f.fullNameBn.trim() || null,
        bankAccount: f.addBank ? {
          bankName: f.bankName.trim(), branchName: f.branchName.trim(), accountHolderName: f.accountHolderName.trim(),
          accountNumber: f.accountNumber.trim(), routingNumber: f.routingNumber.trim() || null,
        } : null,
        acceptedTerms: f.agree,
        preferredLanguage: document.documentElement.lang === "bn" ? "bn" : "en",
      });
      toast.success(t("auth.registered"));
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors(fieldErrors);
      setFormError(getErrorMessage(err));
      const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((k) => fieldErrors[k]));
      if (firstStep >= 0) setStep(firstStep);
      // The record may have been claimed meanwhile — send the person back to the check.
      if (err?.response?.status === 409) { setRecord(null); setStep(0); }
    } finally {
      setLoading(false);
    }
  };

  const steps = [t("auth.step1"), t("auth.step2"), t("auth.step3"), t("auth.step4")];

  return (
    <AuthLayout wide>
      <div className="stack">
        <div>
          <h1>{t("auth.registerTitle")}</h1>
          <p className="text-muted mt-2">{t("auth.registerSub")}</p>
        </div>
        <Stepper steps={steps} current={step} />
        {formError && <Alert tone="danger">{formError}</Alert>}

        <form onSubmit={submit} noValidate className="card" style={{ padding: 24 }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
              {step === 0 && (
                <div className="stack">
                  <p className="text-muted">{t("auth.verifyHint")}</p>
                  <div className="form-grid">
                    <Input className="span-2" label={t("common.pensionId")} required autoComplete="off" value={form.pensionId}
                      onChange={set("pensionId")} error={errors.pensionId} hint={t("auth.pensionIdHint")} autoFocus />
                    <Input label={t("auth.nid")} required inputMode="numeric" value={form.nidNumber} onChange={set("nidNumber")} error={errors.nidNumber} hint={t("auth.nidHint")} />
                    <Input label={t("auth.dob")} type="date" required max={today} value={form.dateOfBirth} onChange={set("dateOfBirth")} error={errors.dateOfBirth} />
                  </div>
                  {!record && (
                    <Button variant="outline" icon={Search} onClick={verify} loading={loading} style={{ alignSelf: "flex-start" }}>{t("auth.verifyBtn")}</Button>
                  )}
                  {record && (
                    <div className="alert alert--success" role="status">
                      <BadgeCheck size={22} aria-hidden />
                      <div className="grow">
                        <div className="alert__title">{t("auth.recordFound")}</div>
                        <dl className="dl mt-2">
                          <dt>{t("common.name")}</dt><dd>{record.fullName}{record.fullNameBn ? ` (${record.fullNameBn})` : ""}</dd>
                          <dt>{t("auth.pensionType")}</dt><dd>{t(`pensionType.${record.pensionType}`)}</dd>
                          <dt>{t("auth.organization")}</dt><dd>{record.formerOrganization} — {record.designation}</dd>
                          <dt>{t("auth.retirementDate")}</dt><dd>{formatDate(record.retirementDate)}</dd>
                          <dt>{t("dash.monthlyPension")}</dt><dd className="amount">{formatMoney(record.monthlyPensionAmount)}</dd>
                        </dl>
                        <p className="text-sm mt-2">{t("auth.notYou")}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {step === 1 && (
                <div className="form-grid">
                  <Input className="span-2" label={t("auth.email")} type="email" required autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
                  <Input className="span-2" label={t("auth.mobile")} type="tel" inputMode="tel" required placeholder="01XXXXXXXXX" value={form.phone} onChange={set("phone")} error={errors.phone}
                    hint={record?.phone ? t("auth.phoneOnRecord", { phone: record.phone }) : undefined} />
                  <PasswordInput label={t("auth.password")} required autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint={t("auth.passwordHint")} />
                  <PasswordInput label={t("auth.confirmPassword")} required autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
                </div>
              )}
              {step === 2 && (
                <div className="stack">
                  <div className="form-grid">
                    <Textarea className="span-2" label={t("auth.address")} required rows={3} value={form.address} onChange={set("address")} error={errors.address} />
                    <Input className="span-2" label={`${t("auth.fullNameBn")} (${t("common.optional")})`} value={form.fullNameBn} onChange={set("fullNameBn")} lang="bn" />
                  </div>
                  <hr className="divider" />
                  <Checkbox label={t("auth.addBankNow")} checked={form.addBank} onChange={set("addBank")} />
                  {form.addBank ? (
                    <div className="form-grid">
                      <Input label={t("bank.bankName")} required value={form.bankName} onChange={set("bankName")} error={errors.bankName} />
                      <Input label={t("bank.branch")} required value={form.branchName} onChange={set("branchName")} error={errors.branchName} />
                      <Input label={t("bank.holder")} required value={form.accountHolderName} onChange={set("accountHolderName")} error={errors.accountHolderName}
                        hint={t("auth.holderHint")} />
                      <Input label={t("bank.number")} required inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={set("accountNumber")} error={errors.accountNumber} />
                      <Input label={`${t("bank.routing")} (${t("common.optional")})`} inputMode="numeric" value={form.routingNumber} onChange={set("routingNumber")} error={errors.routingNumber} />
                    </div>
                  ) : (
                    <Alert tone="info">{t("auth.bankLater")}</Alert>
                  )}
                </div>
              )}
              {step === 3 && record && (
                <div className="stack">
                  <h3>{t("auth.review")}</h3>
                  <dl className="dl">
                    <dt>{t("common.pensionId")}</dt><dd>{record.pensionId}</dd>
                    <dt>{t("common.name")}</dt><dd>{record.fullName}</dd>
                    <dt>{t("dash.monthlyPension")}</dt><dd>{formatMoney(record.monthlyPensionAmount)}</dd>
                    <dt>{t("auth.email")}</dt><dd>{form.email}</dd>
                    <dt>{t("auth.mobile")}</dt><dd>{form.phone}</dd>
                    <dt>{t("auth.address")}</dt><dd>{form.address}</dd>
                    <dt>{t("common.bank")}</dt><dd>{form.addBank ? `${form.bankName} — ${form.accountNumber}` : "—"}</dd>
                  </dl>
                  <Alert tone="info">{t("auth.activeNotice")}</Alert>
                  <Checkbox label={t("auth.agree")} checked={form.agree} onChange={set("agree")} error={errors.agree || errors.acceptedTerms} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="row-between" style={{ marginTop: 24 }}>
            {step > 0 ? (
              <Button variant="outline" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} disabled={loading}>{t("common.back")}</Button>
            ) : (
              <span className="text-sm text-muted">{t("auth.haveAccount")} <Link to="/login">{t("auth.login")}</Link></span>
            )}
            {step < 3 ? (
              <Button type="submit" iconRight={ArrowRight} loading={step === 0 && loading} disabled={step === 0 && !record && loading}>
                {step === 0 && !record ? t("auth.verifyBtn") : t("common.next")}
              </Button>
            ) : (
              <Button type="submit" variant="secondary" icon={Send} loading={loading}>
                {loading ? t("auth.registering") : t("auth.register")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
