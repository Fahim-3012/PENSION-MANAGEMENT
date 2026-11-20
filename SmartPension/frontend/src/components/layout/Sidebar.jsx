import { NavLink } from "react-router-dom";
import { Landmark, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";
import { useNotifications } from "../../context/NotificationContext";

export default function Sidebar({ sections, collapsed, mobileOpen, onToggleCollapse, onNavigate, portalLabel }) {
  const { t, formatNumber } = useI18n();
  const { unread } = useNotifications();

  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "sidebar--open" : ""}`}
      aria-label="Main navigation"
    >
      <div className="sidebar__brand">
        <div className="sidebar__logo" aria-hidden><Landmark size={22} /></div>
        <div className="sidebar__brand-text">
          <div className="sidebar__brand-title">{t("app.name")}</div>
          <div className="sidebar__brand-sub">{portalLabel}</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {sections.map((section) => (
          <div key={section.section}>
            <div className="sidebar__section">{t(section.section)}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const badge = item.badge === "notifications" && unread > 0 ? unread : null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="sidebar__link"
                  onClick={onNavigate}
                  title={collapsed ? t(item.key) : undefined}
                >
                  <Icon size={20} aria-hidden />
                  <span className="sidebar__label">{t(item.key)}</span>
                  {badge && <span className="sidebar__badge" aria-label={`${badge} unread`}>{formatNumber(badge > 99 ? 99 : badge)}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen size={20} aria-hidden /> : <PanelLeftClose size={20} aria-hidden />}
          <span>{collapsed ? t("nav.expand") : t("nav.collapse")}</span>
        </button>
      </div>
    </aside>
  );
}
