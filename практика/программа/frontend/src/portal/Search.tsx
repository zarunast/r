import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleHelp,
  Hash,
  LoaderCircle,
  Search,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import { quotaLabels } from "../types";
import { demoNumber } from "./demo";
import { usePortal, usePublicLoad } from "./state";
import {
  groupKey,
  levelName,
  type PublicGroup,
  type Quota,
  type SearchResult,
} from "./types";
import { PortalNotice } from "./ui";

export function PublicDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const close = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", close);
    return () => {
      el.removeEventListener("cancel", close);
      el.close();
    };
  }, [onClose]);
  return (
    <dialog
      className="p-dialog"
      ref={ref}
      aria-labelledby={id}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div>
        <div className="p-dialog-heading">
          <h2 id={id}>{title}</h2>
          <button
            className="p-icon-button"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

const labels = {
  within_seats: ["В пределах плана мест", "green"],
  outside_seats: ["За пределами плана мест", "amber"],
  tie_at_boundary: ["Равные баллы на границе", "amber"],
  unknown: ["Недостаточно данных", "gray"],
};

export function ApplicantSearch({
  groups,
  onRating,
  onHighlight,
}: {
  groups: PublicGroup[];
  onRating: (g: PublicGroup, quota?: Quota, number?: string) => void;
  onHighlight: (number: string) => void;
}) {
  const { year, setYear, demo, setDemo, reload } = usePortal();
  const [number, setNumber] = useState(demo ? demoNumber : "");
  const [submitted, setSubmitted] = useState("");
  const [validation, setValidation] = useState("");
  const [explanation, setExplanation] = useState<SearchResult | null>(null);
  const close = useRef(() => setExplanation(null)).current;
  const { data, loading, error } = usePublicLoad<SearchResult[]>(
    submitted
      ? `/public/applicants/${encodeURIComponent(submitted)}?year=${year}`
      : null,
  );
  useEffect(() => {
    if (data) onHighlight(submitted);
  }, [data, submitted, onHighlight]);
  return (
    <section
      className="p-search-section"
      id="search"
      aria-labelledby="p-search-title"
    >
      <div className="p-search-card">
        <div className="p-search-heading">
          <div>
            <span className="p-eyebrow">МОЙ КОНКУРС</span>
            <h2 id="p-search-title">Узнай своё место в рейтинге</h2>
          </div>
          <span className="p-search-privacy">
            <ShieldCheck size={15} />
            Без регистрации и персональных данных
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = number.trim();
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
              setValidation(
                "Введи номер абитуриента из заявления на Госуслугах. Сохрани все нули в начале.",
              );
              return;
            }
            setValidation("");
            if (value === submitted) reload();
            else setSubmitted(value);
          }}
        >
          <label className="p-number-input">
            <Hash size={20} />
            <span className="p-visually-hidden">Номер абитуриента ЕПГУ</span>
            <input
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setValidation("");
              }}
              placeholder="Введи номер абитуриента ЕПГУ"
              inputMode="numeric"
              maxLength={64}
              aria-describedby="p-number-hint"
              required
              autoComplete="off"
            />
          </label>
          <label className="p-search-year">
            <span className="p-visually-hidden">Кампания для поиска</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <button
            className="p-button p-button-blue"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="p-spin" size={18} />
            ) : (
              <Search size={18} />
            )}
            {loading ? "Ищем…" : "Проверить мой номер"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="p-search-hints">
          <p id="p-number-hint">
            <CircleHelp size={13} />
            Номер указан в заявлении на Госуслугах. Вводи его вместе с нулями в
            начале.
          </p>
          {!demo && (
            <button onClick={() => setDemo(true)}>
              Посмотреть пример
              <ChevronRight size={13} />
            </button>
          )}
        </div>
        {validation && (
          <p className="p-validation" role="alert">
            {validation}
          </p>
        )}
      </div>
      {submitted && !loading && error && (
        <PortalNotice error>
          {error}
          <button className="p-inline-button" onClick={reload}>
            Повторить поиск
          </button>
        </PortalNotice>
      )}
      {data && (
        <div className="p-search-results" aria-live="polite">
          <div className="p-result-heading">
            <div>
              <span className="p-result-check">
                <BadgeCheck size={23} />
              </span>
              <div>
                <h3>Твои заявления</h3>
                <p>
                  Номер ЕПГУ <strong>{submitted}</strong> · кампания {year}
                </p>
              </div>
            </div>
            <span>
              {data.length}{" "}
              {data.length === 1
                ? "заявление"
                : data.length < 5
                  ? "заявления"
                  : "заявлений"}
            </span>
          </div>
          <div className="p-result-grid">
            {data.map((item, i) => {
              const [label, tone] =
                labels[item.forecast.assessment] || labels.unknown;
              const g = groups.find((g) => groupKey(g) === groupKey(item));
              return (
                <article className="p-result-card" key={i}>
                  <div className="p-result-card-top">
                    <span>
                      {levelName(item.campaign)} · {item.study_form}
                    </span>
                    <span className="p-quota-pill">
                      {quotaLabels[item.quota]}
                    </span>
                  </div>
                  <h4>{g?.title || item.direction}</h4>
                  <div className="p-result-numbers">
                    <div>
                      <strong>
                        {item.forecast.rank ?? "—"}
                        <small>
                          {item.forecast.rank ? "место" : "вне рейтинга"}
                        </small>
                      </strong>
                      <span>Текущий рейтинг</span>
                    </div>
                    <div>
                      <strong>
                        {item.score}
                        <small>баллов</small>
                      </strong>
                      <span>Итог конкурса</span>
                    </div>
                    <div>
                      <strong>
                        {item.forecast.seats ?? "—"}
                        <small>мест</small>
                      </strong>
                      <span>План приёма</span>
                    </div>
                  </div>
                  <div className={`p-assessment p-assessment-${tone}`}>
                    <Target size={17} />
                    <span>{label}</span>
                    <button
                      onClick={() => setExplanation(item)}
                      aria-label={`Как рассчитана оценка: ${g?.title || item.direction}`}
                    >
                      <CircleHelp size={16} />
                    </button>
                  </div>
                  <button
                    className="p-result-link"
                    disabled={!g}
                    onClick={() => {
                      if (g) onRating(g, item.quota, submitted);
                    }}
                  >
                    Открыть конкурсный список
                    <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
          <p className="p-result-disclaimer">
            <ShieldCheck size={14} />
            Оценка отражает текущий рейтинг и не гарантирует зачисление. Решение
            оформляется приказом.
          </p>
        </div>
      )}
      {explanation && (
        <PublicDialog title="Как рассчитана оценка" onClose={close}>
          <div className="p-explanation-icon">
            <Target size={28} />
          </div>
          <p className="p-dialog-lead">
            Сравниваем текущее место с планом мест в выбранной категории
            конкурса.
          </p>
          <ul className="p-factor-list">
            {explanation.forecast.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
          <p className="p-dialog-note">
            Это расчёт по правилам, а не обученная ИИ-модель. Числовую
            вероятность без проверенной модели портал не показывает.
          </p>
          <button className="p-button p-button-blue" onClick={close}>
            Понятно
          </button>
        </PublicDialog>
      )}
    </section>
  );
}
