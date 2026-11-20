import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { notificationApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, SkeletonRows, Tabs } from "../../components/ui";
import { localized } from "../../lib/format";

const toneByType = { success: "success", error: "danger", warning: "warning", info: "info", admin: "accent" };

export default function NotificationsPage() {
  const { t, lang, formatDateTime } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { unread, refresh } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const { data, loading, error, reload, setData } = useApi(
    () => notificationApi.list({ page, pageSize, unreadOnly: filter === "unread" }), [page, filter]
  );

  const patchItem = (id, patch) => setData((d) => d && ({ ...d, items: d.items.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  const markRead = async (n) => {
    try { await notificationApi.markRead(n.id); patchItem(n.id, { isRead: true }); refresh(); }
    catch (e) { toast.error(getErrorMessage(e)); }
  };
  const markAll = async () => {
    try { await notificationApi.markAllRead(); toast.success(t("notif.allRead")); refresh(); reload(); }
    catch (e) { toast.error(getErrorMessage(e)); }
  };
  const remove = async (n) => {
    try { await notificationApi.remove(n.id); toast.success(t("notif.deleted")); refresh(); reload(); }
    catch (e) { toast.error(getErrorMessage(e)); }
  };
  const open = async (n) => {
    if (!n.isRead) await markRead(n);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="stack-lg">
      <PageHeader title={t("notif.title")} subtitle={t("notif.sub")}
        actions={<Button variant="outline" icon={CheckCheck} onClick={markAll} disabled={!unread}>{t("top.markAllRead")}</Button>} />
      <Tabs value={filter} onChange={(v) => { setFilter(v); setPage(1); }}
        tabs={[{ value: "all", label: t("common.all") }, { value: "unread", label: t("notif.unread"), count: unread }]} />
      <Card flush>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <SkeletonRows rows={6} cols={2} />
          : !data?.items.length ? <EmptyState icon={Bell} title={t("notif.empty")} />
          : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.items.map((n) => (
                <li key={n.id} className={`notif-item ${n.isRead ? "" : "notif-item--unread"}`} style={{ cursor: "default", alignItems: "center" }}>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      {!n.isRead && <Badge tone="info" plain>{t("notif.unread")}</Badge>}
                      <Badge tone={toneByType[n.type] || "neutral"} plain>{n.type}</Badge>
                      <span className="notif-item__title">{localized(n, "title", lang)}</span>
                    </div>
                    <p className="text-sm text-muted mt-2">{localized(n, "message", lang)}</p>
                    <div className="notif-item__time">{formatDateTime(n.createdAt)}</div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {n.link && <Button variant="ghost" size="sm" iconOnly icon={ExternalLink} aria-label={t("common.view")} onClick={() => open(n)} />}
                    {!n.isRead && <Button variant="ghost" size="sm" iconOnly icon={CheckCheck} aria-label={t("notif.markRead")} onClick={() => markRead(n)} />}
                    <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={t("common.delete")} onClick={() => remove(n)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        <Pagination page={page} pageSize={pageSize} total={data?.total} onChange={setPage} />
      </Card>
    </div>
  );
}
