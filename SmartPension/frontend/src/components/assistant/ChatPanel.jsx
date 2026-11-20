import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Loader2, Send, X } from "lucide-react";
import { assistantApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useI18n } from "../../context/PreferencesContext";

/** Chat UI for the rule-based pension assistant (answers from the user's live account data). */
export default function ChatPanel({ onClose, compact = false }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(() => [{ from: "bot", text: t("ai.hello"), actions: [] }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setMessages((m) => [...m, { from: "user", text: message }]);
    setSending(true);
    try {
      const res = await assistantApi.chat(message, lang);
      setMessages((m) => [...m, { from: "bot", text: res.reply, actions: res.actions || [] }]);
    } catch (e) {
      setMessages((m) => [...m, { from: "bot", text: `${t("ai.error")} ${getErrorMessage(e, "")}`.trim(), actions: [] }]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [t("ai.s1"), t("ai.s2"), t("ai.s3"), t("ai.s4")];

  return (
    <div className="chat">
      <div className="chat__head">
        <span className="avatar" style={{ width: 36, height: 36 }} aria-hidden><Bot size={20} /></span>
        <div className="grow">
          <div className="fw-600">{t("ai.title")}</div>
          {!compact && <div className="text-xs" style={{ color: "#a9c3bc" }}>{t("ai.sub")}</div>}
        </div>
        {onClose && (
          <button className="icon-btn" style={{ color: "#fff" }} onClick={onClose} aria-label={t("common.close")}>
            <X size={20} />
          </button>
        )}
      </div>

      <div className="chat__body" ref={bodyRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`chat__msg chat__msg--${m.from}`}>
            {m.text}
            {m.actions?.length > 0 && (
              <div className="chat__actions">
                {m.actions.map((a) => (
                  <button key={a.link} className="chip" onClick={() => { navigate(a.link); onClose?.(); }}>{a.label}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="chat__msg chat__msg--bot" aria-label={t("common.loading")}>
            <Loader2 size={16} className="spin" />
          </div>
        )}
      </div>

      <div className="chat__suggestions">
        {suggestions.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={sending}>{s}</button>
        ))}
      </div>
      <form className="chat__form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("ai.placeholder")}
          aria-label={t("ai.placeholder")}
          maxLength={500}
        />
        <button className="btn btn--secondary btn--icon" type="submit" disabled={sending || !input.trim()} aria-label={t("ai.send")}>
          <Send size={18} />
        </button>
      </form>
      <div className="text-xs text-muted" style={{ padding: "0 12px 10px", background: "#fff" }}>{t("ai.engineNote")}</div>
    </div>
  );
}
