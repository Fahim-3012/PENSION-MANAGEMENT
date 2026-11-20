import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "../i18n/en";
import bn from "../i18n/bn";

const dictionaries = { en, bn };
const STORAGE_KEY = "spms_prefs";
const defaults = { lang: "en", fontSize: "normal", reducedMotion: false, sidebarCollapsed: false };

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaults;
  }
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    const html = document.documentElement;
    html.lang = prefs.lang;
    html.dataset.font = prefs.fontSize;
    html.dataset.motion = prefs.reducedMotion ? "reduced" : "full";
  }, [prefs]);

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);

  const value = useMemo(() => {
    const dict = dictionaries[prefs.lang] || en;
    const locale = prefs.lang === "bn" ? "bn-BD" : "en-GB";

    const t = (key, vars) => {
      let text = dict[key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
      return text;
    };
    const money = new Intl.NumberFormat(locale, { style: "currency", currency: "BDT", maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const number = new Intl.NumberFormat(locale);
    const formatMoney = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : money.format(Number(v)));
    const formatNumber = (v) => (v === null || v === undefined ? "—" : number.format(Number(v)));
    const formatDate = (v, opts = { day: "numeric", month: "short", year: "numeric" }) =>
      v ? new Intl.DateTimeFormat(locale, opts).format(new Date(v)) : "—";
    const formatDateTime = (v) =>
      v ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "—";
    const formatPeriod = (year, month) =>
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));

    return { ...prefs, update, t, formatMoney, formatNumber, formatDate, formatDateTime, formatPeriod, locale };
  }, [prefs, update]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePrefs must be used inside PreferencesProvider");
  return ctx;
}

/** Convenience hook for translation + formatting. */
export const useI18n = usePrefs;
