import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  X,
} from "lucide-react";
import { numberFormat } from "../types";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cancel = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={id}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Badge({
  children,
  tone = "blue",
  dot = true,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
export function Busy({ label = "Загружаем данные…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title = "Пока ничего нет",
  text = "Данные появятся здесь после загрузки заявлений.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={26} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ErrorState({ error }: { error: string }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>Не удалось загрузить данные</strong>
        <p>{error}</p>
      </div>
    </div>
  );
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Pagination({
  total,
  offset,
  limit,
  onChange,
}: {
  total: number;
  offset: number;
  limit: number;
  onChange: (n: number) => void;
}) {
  const current = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${numberFormat(offset + 1)}–${numberFormat(Math.min(offset + limit, total))} из ${numberFormat(total)}`
          : "Нет записей"}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          Страница {current} из {pages}
        </span>
        <button
          className="icon-button"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
          aria-label="Следующая страница"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function SaveButton({
  busy,
  label = "Сохранить",
  disabled = false,
}: {
  busy: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="button primary"
      type="submit"
      disabled={busy || disabled}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
      {busy ? "Сохраняем…" : label}
    </button>
  );
}
export function BackLink({
  onClick,
  children = "Назад",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      <ArrowLeft size={16} />
      {children}
    </button>
  );
}
export function Go({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="text-button" href={href}>
      {children}
      <ArrowRight size={16} />
    </a>
  );
}
