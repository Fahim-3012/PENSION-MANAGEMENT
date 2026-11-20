import { CheckCircle2, Globe, Landmark, ShieldCheck } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export default function AuthLayout({ children, wide = false }) {
  const { t, lang, update } = useI18n();
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <div className="row">
          <div className="sidebar__logo" aria-hidden><Landmark size={22} /></div>
          <div>
            <div className="sidebar__brand-title">{t("app.name")}</div>
            <div className="sidebar__brand-sub">{t("app.tagline")}</div>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1>{t("auth.asideTitle")}</h1>
          <div className="auth-aside__points">
            {["auth.point1", "auth.point2", "auth.point3"].map((k) => (
              <div key={k} className="auth-aside__point"><CheckCircle2 size={20} aria-hidden /><span>{t(k)}</span></div>
            ))}
          </div>
        </div>
        <div className="row text-sm" style={{ color: "#a9c3bc" }}>
          <ShieldCheck size={18} aria-hidden /> {t("auth.secure")}
        </div>
      </aside>
      <main className="auth-main">
        <div className={`auth-card ${wide ? "auth-card--wide" : ""}`}>
          <div className="auth-top">
            <div className="row">
              <div className="sidebar__logo" aria-hidden style={{ width: 36, height: 36 }}><Landmark size={20} /></div>
              <strong>{t("app.fullName")}</strong>
            </div>
            <button className="btn btn--outline btn--sm" onClick={() => update({ lang: lang === "en" ? "bn" : "en" })} aria-label="Switch language / ভাষা পরিবর্তন">
              <Globe size={16} aria-hidden /> {t("top.language")}
            </button>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
