import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { notificationApi } from "../api/services";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);
const POLL_MS = 60_000;

/** Shares the unread-notification count between the top bar, sidebar and notification pages. */
export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount();
      setUnread(res.count ?? 0);
    } catch {
      /* non-critical – keep last value */
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setUnread(0); return undefined; }
    refresh();
    const id = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, POLL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, refresh]);

  const value = useMemo(() => ({ unread, refresh, setUnread }), [unread, refresh]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
