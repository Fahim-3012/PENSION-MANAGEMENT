import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Bot } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ChatPanel from "../assistant/ChatPanel";
import { useI18n } from "../../context/PreferencesContext";
import { useAuth } from "../../context/AuthContext";

/** Responsive portal layout: collapsible sidebar, sticky top bar, animated content and floating assistant. */
export default function AppShell({ sections, basePath, portalLabel, showAssistant = false }) {
  const { t, sidebarCollapsed, update } = useI18n();
  const { isSuperAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.superOnly || isSuperAdmin) }))
    .filter((s) => s.items.length);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar
        sections={visibleSections}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => update({ sidebarCollapsed: !sidebarCollapsed })}
        onNavigate={() => setMobileOpen(false)}
        portalLabel={portalLabel}
      />
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden />}

      <div className={`main ${sidebarCollapsed ? "main--collapsed" : ""}`}>
        <Topbar sections={visibleSections} onOpenMenu={() => setMobileOpen(true)} basePath={basePath} />
        <main id="main-content" className="content" tabIndex={-1}>
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>

      {showAssistant && !location.pathname.endsWith("/assistant") && (
        <>
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                className="assistant-panel"
                role="dialog"
                aria-label={t("ai.title")}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
              >
                <ChatPanel compact onClose={() => setChatOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
          <button className="assistant-fab" onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen} aria-label={t("ai.open")}>
            <Bot size={24} aria-hidden />
            <span className="assistant-fab__text">{t("ai.open")}</span>
          </button>
        </>
      )}
    </div>
  );
}
