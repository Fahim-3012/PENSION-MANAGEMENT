import ChatPanel from "../../components/assistant/ChatPanel";
import { PageHeader } from "../../components/ui";
import { useI18n } from "../../context/PreferencesContext";

export default function AssistantPage() {
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHeader title={t("ai.title")} subtitle={t("ai.sub")} />
      <div className="card" style={{ height: "min(680px, calc(100vh - 220px))", overflow: "hidden" }}>
        <ChatPanel />
      </div>
    </div>
  );
}
