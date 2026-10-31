import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  LoaderCircle,
  MessageCircle,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { usePortal } from "./state";
import { official } from "./types";

type Message = { id: number; who: "user" | "assistant"; text: string };
export function Assistant({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { api, demo } = usePortal();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      who: "assistant",
      text: "Привет! Помогу разобраться с номером ЕПГУ, документами и конкурсными списками. Что хочешь узнать?",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    scroll.current?.scrollTo({
      top: scroll.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, open]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);
  const send = async (question: string) => {
    const value = question.trim();
    if (!value || busy) return;
    setMessages((m) => [...m, { id: Date.now(), who: "user", text: value }]);
    setText("");
    setBusy(true);
    try {
      const answer = await api<{ answer: string }>(
        `/public/faq?question=${encodeURIComponent(value)}`,
      );
      if (mounted.current)
        setMessages((m) => [
          ...m,
          { id: Date.now(), who: "assistant", text: answer.answer },
        ]);
    } catch {
      if (mounted.current)
        setMessages((m) => [
          ...m,
          {
            id: Date.now(),
            who: "assistant",
            text: "Сейчас не получается получить ответ. Попробуй позже или перейди на официальную страницу приёмной комиссии по ссылке ниже.",
          },
        ]);
    } finally {
      if (mounted.current) {
        setBusy(false);
        input.current?.focus();
      }
    }
  };
  return (
    <>
      <button
        ref={trigger}
        className={`p-chat-trigger ${open ? "p-chat-is-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label={
          open ? "Закрыть помощника" : "Открыть помощника абитуриента"
        }
        aria-expanded={open}
      >
        <MessageCircle size={23} />
        <span>Поможем поступить</span>
        <span className="p-chat-trigger-dot" />
      </button>
      {open && (
        <section
          className="p-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Помощник абитуриента"
        >
          <div className="p-chat-heading">
            <span className="p-chat-avatar">
              <GraduationIcon />
            </span>
            <div>
              <h2>Помощник абитуриента</h2>
              <p>
                <span />
                БГТУ · {demo ? "демонстрация" : "ответы на частые вопросы"}
              </p>
            </div>
            <button
              className="p-icon-button"
              aria-label="Закрыть чат"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={19} />
            </button>
          </div>
          <div className="p-chat-messages" ref={scroll} aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-chat-message p-chat-${message.who}`}
              >
                {message.who === "assistant" && (
                  <span className="p-chat-message-label">БГТУ</span>
                )}
                <p>{message.text}</p>
              </div>
            ))}
            {busy && (
              <span className="p-chat-typing" role="status">
                <LoaderCircle size={14} className="p-spin" />
                Готовим ответ…
              </span>
            )}
            {messages.length === 1 && (
              <div className="p-chat-suggestions">
                {[
                  "Где найти номер ЕПГУ?",
                  "Какие нужны документы?",
                  "Как понимать оценку шансов?",
                ].map((question) => (
                  <button key={question} onClick={() => send(question)}>
                    {question}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-chat-form">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <input
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Задай вопрос о поступлении"
                aria-label="Вопрос помощнику"
                maxLength={500}
                disabled={busy}
              />
              <button
                type="submit"
                aria-label="Отправить вопрос"
                disabled={busy || !text.trim()}
              >
                <Send size={18} />
              </button>
            </form>
            <p>
              <ShieldCheck size={10} />
              Не указывай паспорт, СНИЛС и контакты в сообщении.
            </p>
            <a href={official} target="_blank" rel="noreferrer">
              Контакты приёмной комиссии
              <ArrowUpRight size={11} />
            </a>
          </div>
        </section>
      )}
    </>
  );
}
function GraduationIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="m2 8 10-5 10 5-10 5-10-5Zm4 3v6c4 3 8 3 12 0v-6M22 8v8" />
    </svg>
  );
}
