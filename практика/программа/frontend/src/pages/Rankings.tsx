import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CircleHelp,
  RefreshCw,
  Settings2,
  Trophy,
} from "lucide-react";
import { jsonBody, saveFile, useLoad, useStore } from "../store";
import {
  numberFormat,
  params,
  quotaLabels,
  type Group,
  type Quota,
  type Rank,
  type RankingsData,
} from "../types";
import {
  Badge,
  Busy,
  Empty,
  ErrorState,
  Modal,
  PageHeading,
  SaveButton,
} from "../components/ui";
import { GroupPicker } from "../components/GroupPicker";
import { ApplicantCard } from "./Registry";

export function csvFile(rows: Record<string, unknown>[], filename: string) {
  const escape = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const columns = Object.keys(rows[0] || {});
  const text =
    "\ufeff" +
    [columns, ...rows.map((r) => columns.map((k) => r[k]))]
      .map((row) => row.map(escape).join(";"))
      .join("\r\n");
  saveFile(new Blob([text], { type: "text/csv;charset=utf-8" }), filename);
}

export function Rankings() {
  const { year, demo, refresh, notify, download } = useStore();
  const catalog = useLoad<Group[]>(`/catalog/groups?year=${year}`);
  const [groupIndex, setGroupIndex] = useState(0);
  const [quota, setQuota] = useState<Quota>("general");
  const [plan, setPlan] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const group = catalog.data?.[groupIndex] || catalog.data?.[0];
  const query = params({ year, ...group });
  const { data, loading, error } = useLoad<RankingsData>(
    group ? `/rankings?${query}` : null,
  );
  const rows = data?.lists[quota] || [];
  const seatCount = data?.seats[quota];
  const boundary = seatCount ? rows[seatCount - 1]?.score : undefined;
  const exportRows = () =>
    rows.map((r: Rank) => ({
      Место: r.rank,
      "Номер ЕПГУ": r.applicant_number,
      ФИО: r.full_name,
      Баллы: r.score,
      Приоритет: r.priority,
      Согласие: r.consent ? "Да" : "Нет",
    }));
  return (
    <>
      <PageHeading
        title="Конкурсные рейтинги"
        subtitle="Пять конкурсных списков для каждой группы поступления"
      >
        <button
          className="button"
          onClick={() => {
            refresh();
            notify("Конкурсные списки обновлены");
          }}
        >
          <RefreshCw size={16} />
          Обновить списки
        </button>
        <button
          className="button primary"
          disabled={!rows.length}
          onClick={async () => {
            try {
              if (demo) csvFile(exportRows(), "ranking-demo.csv");
              else
                await download(
                  `/reports/ranking?${query}&quota=${quota}&format=xlsx`,
                  "ranking.xlsx",
                );
              notify("Рейтинг выгружен");
            } catch (e) {
              notify((e as Error).message, "error");
            }
          }}
        >
          <ArrowDownToLine size={17} />
          {demo ? "Экспорт CSV" : "Экспорт Excel"}
        </button>
      </PageHeading>
      <section className="panel ranking-controls">
        <GroupPicker
          groups={catalog.data || []}
          index={groupIndex}
          onChange={setGroupIndex}
        />
        <button
          className="button"
          disabled={!group}
          onClick={() => setPlan(true)}
        >
          <Settings2 size={16} />
          План приёма
        </button>
      </section>
      {catalog.error && <ErrorState error={catalog.error} />}
      <div className="ranking-metrics">
        <div>
          <span>Заявлений в конкурсе</span>
          <strong>{numberFormat(rows.length)}</strong>
        </div>
        <div>
          <span>Мест по плану приёма</span>
          <strong>{seatCount ?? "Не задано"}</strong>
        </div>
        <div>
          <span>
            Баллы на границе мест
            <CircleHelp size={13} />
          </span>
          <strong>{boundary ?? "—"}</strong>
        </div>
        <span className="ranking-hint">
          <Trophy size={23} />
          <span>
            Баллы ЕГЭ + достижения
            <br />
            <small>Льготы определяют категорию конкурса</small>
          </span>
        </span>
      </div>
      <section className="panel">
        <div className="tabs quota-tabs">
          {(Object.entries(quotaLabels) as [Quota, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                className={quota === key ? "active" : ""}
                onClick={() => setQuota(key)}
              >
                {label}
                <span>{data?.lists[key]?.length || 0}</span>
              </button>
            ),
          )}
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : loading || catalog.loading ? (
          <Busy />
        ) : !rows.length ? (
          <Empty
            title="В этой категории пока нет заявлений"
            text="Выберите другую конкурсную группу или категорию."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="center">Место</th>
                  <th>Абитуриент</th>
                  <th>Номер ЕПГУ</th>
                  <th>Баллы</th>
                  <th className="center">Приоритет</th>
                  <th>Согласие</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.application_id}>
                    <td className="center">
                      <span
                        className={`rank-number ${row.rank <= 3 ? "rank-top" : ""}`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td>
                      <button
                        className="table-person text-dark"
                        onClick={() => setPerson(row.applicant_number)}
                      >
                        {row.full_name}
                      </button>
                    </td>
                    <td className="mono muted">{row.applicant_number}</td>
                    <td>
                      <strong className="score-label">{row.score}</strong>
                    </td>
                    <td className="center">{row.priority}</td>
                    <td>
                      {row.consent ? (
                        <Badge tone="green">
                          <Check size={11} />
                          Получено
                        </Badge>
                      ) : (
                        <Badge tone="gray" dot={false}>
                          Не подано
                        </Badge>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Карточка ${row.full_name}`}
                        onClick={() => setPerson(row.applicant_number)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-note">
          <CircleHelp size={15} />
          Рейтинг отражает текущую ситуацию. При равных баллах место одинаковое;
          окончательное зачисление оформляется приказом.
        </div>
      </section>
      {person && (
        <ApplicantCard number={person} onClose={() => setPerson(null)} />
      )}
      {plan && group && (
        <PlanModal
          group={group}
          quota={quota}
          seats={seatCount}
          onClose={() => setPlan(false)}
        />
      )}
    </>
  );
}

function PlanModal({
  group,
  quota,
  seats,
  onClose,
}: {
  group: Group;
  quota: Quota;
  seats?: number;
  onClose: () => void;
}) {
  const { api, year, refresh, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="План приёма"
      subtitle={`${group.direction} · ${quotaLabels[quota]}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api(
              "/seat-plans",
              jsonBody(
                { year, ...group, quota, seats: Number(form.get("seats")) },
                "PUT",
              ),
            );
            refresh();
            notify("План приёма сохранён");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Количество мест
          <input
            name="seats"
            type="number"
            min={0}
            max={100000}
            defaultValue={seats || 0}
            required
          />
        </label>
        <p className="form-hint">
          План используется для оценки заполненности и положения абитуриентов в
          рейтинге.
        </p>
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Отмена
          </button>
          <SaveButton busy={busy} />
        </div>
      </form>
    </Modal>
  );
}
