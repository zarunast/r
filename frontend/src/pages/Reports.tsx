import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  FileChartColumn,
  FileJson2,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import { useLoad, useStore } from "../store";
import {
  numberFormat,
  params,
  quotaLabels,
  type Group,
  type Statistics,
} from "../types";
import {
  Badge,
  Busy,
  Empty,
  ErrorState,
  Modal,
  PageHeading,
} from "../components/ui";
import { GroupPicker } from "../components/GroupPicker";
import { csvFile } from "./Rankings";

export function Reports() {
  const { year, demo, download, notify } = useStore();
  const { data, loading, error } = useLoad<Statistics>(
    `/reports/statistics?year=${year}`,
  );
  const [report, setReport] = useState<"ranking" | "1c" | null>(null);
  const groups = useLoad<Group[]>(`/catalog/groups?year=${year}`);
  const exportStats = () => {
    if (!data) return;
    csvFile(
      data.groups.map((g) => ({
        Направление: g.direction,
        Кампания: g.campaign,
        Форма: g.study_form,
        Категория: quotaLabels[g.quota],
        "Подано заявлений": g.applications,
        "В конкурсе": g.active,
        "План мест": g.seats ?? "Не задан",
      })),
      `statistics-${year}.csv`,
    );
    notify("Статистика приёма выгружена");
  };
  const cards = [
    {
      title: "Конкурсные списки",
      description: "Рейтинг по направлению и категории конкурса",
      icon: FileChartColumn,
      type: "Excel / PDF",
      action: () => setReport("ranking"),
      color: "blue",
    },
    {
      title: "Ведомость бухгалтерии",
      description: "Договоры, этапы подписания и оплата",
      icon: FileSpreadsheet,
      type: "Excel",
      action: async () => {
        try {
          await download(
            `/reports/accounting?year=${year}`,
            `accounting-${year}.xlsx`,
          );
          notify("Ведомость выгружена");
        } catch (err) {
          notify((err as Error).message, "error");
        }
      },
      color: "green",
    },
    {
      title: "Пакет данных для 1С",
      description: "Данные после приказа о зачислении",
      icon: FileJson2,
      type: "JSON / XML",
      action: () => setReport("1c"),
      color: "violet",
    },
  ];
  return (
    <>
      <PageHeading
        title="Отчёты и статистика"
        subtitle={`Результаты приёмной кампании ${year} и выгрузки для подразделений`}
      >
        <button
          className="button primary"
          onClick={exportStats}
          disabled={!data?.groups.length}
        >
          <ArrowDownToLine size={17} />
          Экспорт статистики
        </button>
      </PageHeading>
      <div className="report-cards">
        {cards.map(
          ({ title, description, icon: Icon, type, action, color }) => (
            <button className="report-card panel" key={title} onClick={action}>
              <div>
                <span className={`metric-icon icon-${color}`}>
                  <Icon size={23} />
                </span>
                <span className="file-type">{type}</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="report-card-link">
                Сформировать отчёт
                <ArrowRight size={16} />
              </span>
            </button>
          ),
        )}
      </div>
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <Busy />
      ) : (
        data && (
          <>
            <div className="stats-overview">
              <div className="panel">
                <span className="overview-label">
                  <Users size={16} />
                  Абитуриентов
                </span>
                <strong>{numberFormat(data.applicants)}</strong>
                <small>Уникальных участников кампании</small>
              </div>
              <div className="panel">
                <span className="overview-label">
                  <FileSpreadsheet size={16} />
                  Подано заявлений
                </span>
                <strong>{numberFormat(data.applications)}</strong>
                <small>На все направления и формы обучения</small>
              </div>
              <div className="panel">
                <span className="overview-label">
                  <BarChart3 size={16} />
                  Зачислено
                </span>
                <strong>{numberFormat(data.statuses.enrolled || 0)}</strong>
                <small>По внесённым приказам о зачислении</small>
              </div>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Заполненность направлений</h2>
                  <p>
                    Количество действующих заявлений относительно плана мест
                  </p>
                </div>
                <Badge tone="blue" dot={false}>
                  {data.groups.length} конкурсных групп
                </Badge>
              </div>
              {!data.groups.length ? (
                <Empty
                  title="Нет данных для отчёта"
                  text="Загрузите заявления и задайте план приёма по направлениям."
                />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Направление</th>
                        <th>Категория</th>
                        <th className="center">Подано</th>
                        <th className="center">Мест</th>
                        <th>Конкурс на место</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.groups.map((g, i) => (
                        <tr key={i}>
                          <td>
                            <div className="table-two-lines">
                              <strong>{g.direction}</strong>
                              <small>
                                {g.study_form} · {g.campaign}
                              </small>
                            </div>
                          </td>
                          <td>{quotaLabels[g.quota]}</td>
                          <td className="center">
                            {numberFormat(g.applications)}
                          </td>
                          <td className="center">{g.seats ?? "—"}</td>
                          <td>
                            <div className="competition-cell">
                              <span>
                                {g.seats
                                  ? (g.active / g.seats).toFixed(1)
                                  : "—"}
                              </span>
                              <span className="competition-track">
                                <i
                                  style={{
                                    width: `${g.seats ? Math.min(100, (g.active / g.seats) * 35) : 0}%`,
                                  }}
                                />
                              </span>
                            </div>
                          </td>
                          <td>
                            {g.overcrowded ? (
                              <Badge tone="amber">Выше плана</Badge>
                            ) : (
                              <Badge tone="gray" dot={false}>
                                {g.seats === null
                                  ? "Нет плана"
                                  : "В пределах плана"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}
      {demo && (
        <p className="page-footnote">
          В демо-режиме доступен CSV со статистикой. Excel, PDF и пакет для 1С
          формируются из рабочей базы после входа.
        </p>
      )}
      {report && (
        <ReportModal
          kind={report}
          groups={groups.data || []}
          onClose={() => setReport(null)}
        />
      )}
    </>
  );
}

function ReportModal({
  kind,
  groups,
  onClose,
}: {
  kind: "ranking" | "1c";
  groups: Group[];
  onClose: () => void;
}) {
  const { year, demo, download, notify } = useStore();
  const [index, setIndex] = useState(0);
  const [quota, setQuota] = useState("general");
  const [format, setFormat] = useState(kind === "ranking" ? "xlsx" : "json");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={
        kind === "ranking"
          ? "Выгрузка конкурсного списка"
          : "Пакет данных для 1С"
      }
      subtitle={`Приёмная кампания ${year}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (kind === "ranking")
              await download(
                `/reports/ranking?${params({ year, ...groups[index], quota, format })}`,
                `ranking-${year}.${format}`,
              );
            else
              await download(
                `/exports/1c?year=${year}&format=${format}`,
                `enrolled-${year}.${format}`,
              );
            notify("Файл отчёта сформирован");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {kind === "ranking" ? (
          <>
            <GroupPicker groups={groups} index={index} onChange={setIndex} />
            <label className="field">
              Категория конкурса
              <select value={quota} onChange={(e) => setQuota(e.target.value)}>
                {Object.entries(quotaLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="notice-inline">
            В пакет включаются только абитуриенты с внесённым приказом о
            зачислении. Файл содержит персональные данные и предназначен для
            внутренней передачи.
          </div>
        )}
        <label className="field">
          Формат
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {(kind === "ranking"
              ? [
                  ["xlsx", "Excel (.xlsx)"],
                  ["pdf", "PDF (.pdf)"],
                ]
              : [
                  ["json", "JSON (.json)"],
                  ["xml", "XML (.xml)"],
                ]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {demo && (
          <p className="form-hint">
            Для формирования отчёта{" "}
            <a href="#/login" onClick={onClose}>
              войдите в рабочую базу
            </a>
            .
          </p>
        )}
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || (kind === "ranking" && !groups.length)}
          >
            <ArrowDownToLine size={17} />
            {busy ? "Формируем…" : "Скачать файл"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
