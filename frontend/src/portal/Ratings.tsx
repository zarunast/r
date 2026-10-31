import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Hash,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { numberFormat, params, quotaLabels } from "../types";
import { usePortal, usePublicLoad } from "./state";
import {
  groupKey,
  fundingLabel,
  levelName,
  official,
  quotaOrder,
  type PublicGroup,
  type PublicRankings,
  type Quota,
} from "./types";
import { PortalBusy, PortalNotice } from "./ui";

export function PublicRatings({
  groups,
  selected,
  onSelect,
  quota,
  onQuota,
  highlight,
  loadingCatalog,
}: {
  groups: PublicGroup[];
  selected?: PublicGroup;
  onSelect: (g: PublicGroup) => void;
  quota: Quota;
  onQuota: (q: Quota) => void;
  highlight: string;
  loadingCatalog: boolean;
}) {
  const { year, reload, demo } = usePortal();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [exported, setExported] = useState(false);
  const { data, loading, error } = usePublicLoad<PublicRankings>(
    selected
      ? `/public/rankings?${params({ year, direction: selected.direction, campaign: selected.campaign, study_form: selected.study_form })}`
      : null,
  );
  useEffect(() => {
    setPage(0);
    setQuery("");
  }, [selected, quota]);
  const all = data?.[quota] || [];
  const filtered = all.filter((r) => r.applicant_number.includes(query.trim()));
  const shown = filtered.slice(page * 15, (page + 1) * 15);
  const seats = selected?.seats[quota];
  const exportCSV = () => {
    const escape = (v: unknown) => {
      let text = String(v ?? "");
      if (/^[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      ["Место", "Номер ЕПГУ", "Баллы", "Категория", "Направление", "Год"],
      ...all.map((r) => [
        r.rank,
        r.applicant_number,
        r.score,
        quotaLabels[quota],
        selected?.title,
        year,
      ]),
    ];
    const blob = new Blob(
      ["\ufeff" + rows.map((row) => row.map(escape).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bgtu-rating-${year}-${quota}${demo ? "-demo" : ""}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    setTimeout(() => setExported(false), 3500);
  };
  return (
    <section className="p-section p-ratings-section" id="ratings">
      <div className="p-section-heading">
        <div>
          <span className="p-eyebrow">ВСЁ ПРОЗРАЧНО</span>
          <h2>Конкурсные списки</h2>
          <p>Выбери конкурсную группу и найди свой номер среди поступающих.</p>
        </div>
        <span className="p-public-label">
          <ShieldCheck size={15} />
          Обезличенные данные
        </span>
      </div>
      <div className="p-ratings-panel">
        <div className="p-ratings-filters">
          <label>
            <span>Направление и форма обучения</span>
            <select
              value={selected ? groupKey(selected) : ""}
              onChange={(e) => {
                const item = groups.find((g) => groupKey(g) === e.target.value);
                if (item) onSelect(item);
              }}
              aria-label="Конкурсная группа"
              disabled={!groups.length}
            >
              {!groups.length && (
                <option value="">Списки пока не опубликованы</option>
              )}
              {groups.map((g) => (
                <option value={groupKey(g)} key={groupKey(g)}>
                  {g.title} · {g.study_form} · {levelName(g.campaign)} ·{" "}
                  {fundingLabel(g)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="p-button p-button-outline"
            onClick={reload}
            disabled={loading || loadingCatalog}
          >
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>
        <div
          className="p-quota-tabs"
          role="group"
          aria-label="Категории конкурса"
        >
          {quotaOrder.map((q) => (
            <button
              key={q}
              className={quota === q ? "active" : ""}
              onClick={() => onQuota(q)}
              aria-pressed={quota === q}
            >
              {quotaLabels[q]}
              <span>{data ? numberFormat(data[q]?.length || 0) : "—"}</span>
            </button>
          ))}
        </div>
        <div className="p-ratings-summary">
          <div>
            <span className="p-summary-icon">
              <Trophy size={19} />
            </span>
            <p>
              <strong>
                {data ? numberFormat(all.length) : "—"}{" "}
                <small>заявлений в конкурсе</small>
              </strong>
              <span>
                План мест: <b>{seats ?? "не опубликован"}</b>
              </span>
            </p>
          </div>
          <label className="p-rating-search">
            <Search size={15} />
            <input
              aria-label="Найти номер в списке"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Найти свой номер"
              maxLength={64}
            />
          </label>
          <button
            className="p-export"
            onClick={exportCSV}
            disabled={!all.length}
          >
            <ArrowDownToLine size={15} />
            Скачать CSV
          </button>
        </div>
        {error ? (
          <PortalNotice error>
            {error}
            <button className="p-inline-button" onClick={reload}>
              Попробовать ещё раз
            </button>
          </PortalNotice>
        ) : loading || loadingCatalog ? (
          <PortalBusy />
        ) : !selected || !all.length ? (
          <div className="p-small-empty">
            <ClipboardIcon />
            <h3>
              {selected
                ? "В этой категории пока нет участников"
                : "Списки кампании пока не опубликованы"}
            </h3>
            <p>
              {selected
                ? "Попробуй другую категорию конкурса или направление."
                : "Следи за информацией приёмной комиссии на официальной странице БГТУ."}
            </p>
            {!selected && (
              <a
                href={official}
                target="_blank"
                rel="noreferrer"
                className="p-text-link"
              >
                Перейти на официальный сайт
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        ) : !shown.length ? (
          <div className="p-small-empty">
            <Search size={25} />
            <h3>Такого номера в этом списке нет</h3>
            <p>Проверь номер или выбери другой конкурс.</p>
            <button className="p-inline-button" onClick={() => setQuery("")}>
              Сбросить поиск
            </button>
          </div>
        ) : (
          <div className="p-table-scroll">
            <table className="p-rating-table">
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Номер абитуриента ЕПГУ</th>
                  <th>Итоговые баллы</th>
                  <th>Категория конкурса</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr
                    key={row.applicant_number}
                    className={
                      highlight === row.applicant_number ? "p-own-row" : ""
                    }
                  >
                    <td>
                      <span
                        className={`p-place ${row.rank <= 3 ? "p-place-top" : ""}`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td>
                      <span className="p-table-number">
                        <Hash size={13} />
                        {row.applicant_number}
                      </span>
                      {highlight === row.applicant_number && (
                        <span className="p-your-number">Твой номер</span>
                      )}
                    </td>
                    <td>
                      <strong>{row.score}</strong>
                      <small className="p-points-label"> баллов</small>
                    </td>
                    <td>
                      <span className="p-table-quota">
                        {quotaLabels[row.quota]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="p-table-pagination">
            <span>
              {numberFormat(page * 15 + 1)}–
              {numberFormat(Math.min((page + 1) * 15, filtered.length))} из{" "}
              {numberFormat(filtered.length)} участников
            </span>
            <div>
              <button
                className="p-icon-button"
                aria-label="Предыдущая страница рейтинга"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(filtered.length / 15))}
              </span>
              <button
                className="p-icon-button"
                aria-label="Следующая страница рейтинга"
                disabled={(page + 1) * 15 >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
        <div className="p-ratings-note">
          <CircleHelp size={16} />
          <p>
            При равных баллах отображается одинаковое место. Льготы определяют
            категорию конкурса, а не добавляют баллы. Публикация списка не
            является приказом о зачислении.
          </p>
        </div>
        <span className="p-visually-hidden" role="status">
          {exported ? "Конкурсный список сохранён в CSV" : ""}
        </span>
      </div>
    </section>
  );
}
function ClipboardIcon() {
  return <BookIcon />;
}
function BookIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v4H9zM8 11h8M8 15h8M8 18h5" />
    </svg>
  );
}
