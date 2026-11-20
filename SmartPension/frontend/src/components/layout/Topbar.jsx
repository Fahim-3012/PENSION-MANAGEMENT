import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Globe, LogOut, Menu, Search, Type, UserRound, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/PreferencesContext";
import { useNotifications } from "../../context/NotificationContext";
import { notificationApi, authApi } from "../../api/services";
import { Dropdown, Segmented } from "../ui";
import { localized } from "../../lib/format";

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "U";
}

/** Page search: filters sidebar items; admins can jump to a pensioner search. */
function GlobalSearch({ sections, isAdmin, basePath }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const items = sections.flatMap((s) => s.items).filter((i) => t(i.key).toLowerCase().includes(term));
    const list = items.slice(0, 6).map((i) => ({ label: t(i.key), to: i.to, icon: i.icon }));
    if (isAdmin) list.push({ label: t("top.searchPensioners", { q: q.trim() }), to: `${basePath}/pensioners?search=${encodeURIComponent(q.trim())}`, icon: Users });
    return list;
  }, [q, sections, t, isAdmin, basePath]);

  const go = (r) => { navigate(r.to); setQ(""); setOpen(false); };

  const onKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    if (e.key === "Enter") { e.preventDefault(); go(results[active] || results[0]); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="topbar__search dropdown" role="search">
      <Search size={18} aria-hidden />
      <input
        type="search"
        value={q}
        placeholder={isAdmin ? t("top.searchAdmin") : t("top.search")}
        aria-label={t("common.search")}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKeyDown}
      />
      {open && q.trim() && (
        <div className="dropdown__menu topbar__results" role="listbox">
          {results.length === 0 && <div className="dropdown__item text-muted">{t("top.noResults")}</div>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <button
                key={r.to}
                type="button"
                role="option"
                aria-selected={i === active}
                className="dropdown__item"
                style={i === active ? { background: "var(--c-primary-50)" } : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r)}
              >
                <Icon size={18} aria-hidden /> {r.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationBell({ basePath }) {
  const { t, lang, formatDateTime } = useI18n();
  const { unread, refresh } = useNotifications();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  const load = async () => {
    try {
      const res = await notificationApi.list({ page: 1, pageSize: 6 });
      setItems(res.items);
    } catch {
      setItems([]);
    }
  };

  const openItem = async (n, close) => {
    close();
    if (!n.isRead) {
      try { await notificationApi.markRead(n.id); refresh(); } catch { /* ignore */ }
    }
    navigate(n.link || `${basePath}/notifications`);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((list) => list?.map((n) => ({ ...n, isRead: true })));
      refresh();
    } catch { /* ignore */ }
  };

  return (
    <Dropdown
      menuClassName="notif-menu"
      trigger={(props) => (
        <button
          {...props}
          className="icon-btn"
          aria-label={`${t("top.notifications")}${unread ? ` (${unread})` : ""}`}
          onClick={() => { props.onClick(); if (!props["aria-expanded"]) load(); }}
        >
          <Bell size={20} />
          {unread > 0 && <span className="icon-btn__dot">{unread > 9 ? "9+" : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="notif-menu__head">
            <strong>{t("top.notifications")}</strong>
            {unread > 0 && <button className="btn btn--ghost btn--sm" onClick={markAll}>{t("top.markAllRead")}</button>}
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {items === null && <div className="dropdown__item text-muted">{t("common.loading")}</div>}
            {items?.length === 0 && <div className="dropdown__item text-muted">{t("top.noNotifications")}</div>}
            {items?.map((n) => (
              <button key={n.id} className={`notif-item ${n.isRead ? "" : "notif-item--unread"}`} onClick={() => openItem(n, close)}>
                <div className="grow">
                  <div className="notif-item__title">{localized(n, "title", lang)}</div>
                  <div className="notif-item__msg">{localized(n, "message", lang)}</div>
                  <div className="notif-item__time">{formatDateTime(n.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ padding: 8 }}>
            <button className="btn btn--outline btn--sm btn--block" onClick={() => { close(); navigate(`${basePath}/notifications`); }}>
              {t("common.viewAll")}
            </button>
          </div>
        </>
      )}
    </Dropdown>
  );
}

function DisplaySettings() {
  const { t, fontSize, reducedMotion, update } = useI18n();
  return (
    <Dropdown
      trigger={(props) => (
        <button {...props} className="icon-btn" aria-label={t("top.display")} title={t("top.display")}>
          <Type size={20} />
        </button>
      )}
    >
      <div style={{ padding: 10 }} className="stack-sm">
        <strong>{t("top.display")}</strong>
        <span className="text-sm text-muted">{t("top.fontSize")}</span>
        <Segmented
          label={t("top.fontSize")}
          value={fontSize}
          onChange={(v) => update({ fontSize: v })}
          options={[
            { value: "normal", label: "A" },
            { value: "large", label: "A+" },
            { value: "xlarge", label: "A++" },
          ]}
        />
        <label className="checkbox mt-2">
          <input type="checkbox" checked={reducedMotion} onChange={(e) => update({ reducedMotion: e.target.checked })} />
          <span className="text-sm">{t("top.reduceMotion")}</span>
        </label>
      </div>
    </Dropdown>
  );
}

export default function Topbar({ sections, onOpenMenu, basePath }) {
  const { user, logout, isAdmin } = useAuth();
  const { t, lang, update } = useI18n();
  const navigate = useNavigate();
  const role = user?.roles?.includes("SuperAdmin") ? "SuperAdmin" : user?.roles?.[0];

  const toggleLanguage = () => {
    const next = lang === "en" ? "bn" : "en";
    update({ lang: next });
    authApi.setLanguage(next).catch(() => { /* preference still saved locally */ });
  };

  return (
    <header className="topbar">
      <button className="icon-btn topbar__menu" onClick={onOpenMenu} aria-label={t("nav.openMenu")}>
        <Menu size={22} />
      </button>
      <GlobalSearch sections={sections} isAdmin={isAdmin} basePath={basePath} />
      <div className="topbar__actions">
        <button className="icon-btn lang-btn" onClick={toggleLanguage} aria-label="Switch language / ভাষা পরিবর্তন">
          <Globe size={18} aria-hidden /> {t("top.language")}
        </button>
        <DisplaySettings />
        <NotificationBell basePath={basePath} />
        <Dropdown
          trigger={(props) => (
            <button {...props} className="profile-btn" aria-label={t("top.profile")}>
              <span className="avatar">{initials(user?.fullName)}</span>
              <span className="profile-btn__text">
                <span className="profile-btn__name" style={{ display: "block" }}>{user?.fullName}</span>
                <span className="profile-btn__role">{t(`role.${role}`)}</span>
              </span>
              <ChevronDown size={16} aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <>
              <div style={{ padding: "8px 12px" }}>
                <div className="fw-600">{user?.fullName}</div>
                <div className="text-sm text-muted">{user?.email}</div>
                {user?.pensionId && <div className="text-xs text-muted">{t("common.pensionId")}: {user.pensionId}</div>}
              </div>
              <div className="dropdown__sep" />
              <button className="dropdown__item" role="menuitem" onClick={() => { close(); navigate(`${basePath}/profile`); }}>
                <UserRound size={18} aria-hidden /> {t("top.profile")}
              </button>
              <button className="dropdown__item" role="menuitem" onClick={() => { close(); logout(); navigate("/login"); }}>
                <LogOut size={18} aria-hidden /> {t("top.logout")}
              </button>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
