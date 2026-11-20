import { Compass } from "lucide-react";
import { useAuth, homeFor } from "../context/AuthContext";
import { Button, EmptyState } from "../components/ui";
import { useI18n } from "../context/PreferencesContext";

export default function NotFoundPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <div style={{ paddingTop: "10vh" }}>
      <EmptyState
        icon={Compass}
        title="404 — Page not found"
        message="The page you are looking for doesn't exist or has moved."
        action={<Button to={user ? homeFor(user) : "/login"}>{t("nav.dashboard")}</Button>}
      />
    </div>
  );
}
