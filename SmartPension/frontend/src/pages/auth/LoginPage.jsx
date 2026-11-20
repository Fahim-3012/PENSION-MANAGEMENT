import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Mail } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Input, PasswordInput } from "../../components/ui";
import { homeFor, useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { patterns } from "../../lib/validators";

export default function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!patterns.email.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.password) next.password = t("common.required");
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setFormError("");
    try {
      const user = await login(form.email.trim(), form.password);
      const from = location.state?.from;
      const target = from && from.startsWith(homeFor(user).split("/").slice(0, 2).join("/")) ? from : homeFor(user);
      navigate(target, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="stack-lg">
        <div>
          <h1>{t("auth.welcomeBack")}</h1>
          <p className="text-muted mt-2">{t("auth.loginSub")}</p>
        </div>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <form className="stack" onSubmit={submit} noValidate>
          <Input
            label={t("auth.email")}
            type="email"
            autoComplete="username"
            required
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            autoFocus
          />
          <PasswordInput
            label={t("auth.password")}
            autoComplete="current-password"
            required
            value={form.password}
            onChange={set("password")}
            error={errors.password}
          />
          <Button type="submit" size="lg" block loading={loading} icon={LogIn}>
            {loading ? t("auth.signingIn") : t("auth.login")}
          </Button>
        </form>
        <div className="card" style={{ padding: 16 }}>
          <div className="row-between">
            <span className="text-muted">{t("auth.noAccount")}</span>
            <Link to="/register" className="btn btn--outline btn--sm"><Mail size={16} aria-hidden /> {t("auth.createAccount")}</Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
