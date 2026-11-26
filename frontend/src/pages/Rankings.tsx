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
  const [priority, setPriority] = useState("");
  const [plan, setPlan] = useState(false);
  const [reference, setReference] = useState(false);
  const [order, setOrder] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const group = catalog.data?.[groupIndex] || catalog.data?.[0];
  const query = params({ year, ...group });
  const { data, loading, error } = useLoad<RankingsData>(
    group ? `/rankings?${query}` : null,
  );
  const rows = data?.lists[quota] || [];
  const priorities = [...new Set(rows.map((row) => row.priority))].sort(
    (a, b) => a - b,
  );
  const filteredRows = priority
    ? rows.filter((row) => String(row.priority) === priority)
    : rows;
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
          disabled={demo ? !rows.length : !group}
          onClick={async () => {
            try {
              if (demo) csvFile(exportRows(), "ranking-demo.csv");
              else
                await download(
                  `/reports/ranking-workbook?year=${year}`,
                  `Конкурсные списки ${year}.xlsx`,
                );
              notify("Рейтинг выгружен");
            } catch (e) {
              notify((e as Error).message, "error");
            }
          }}
        >
          <ArrowDownToLine size={17} />
          {demo ? "Экспорт CSV" : "Скачать все списки Excel"}
        </button>
      </PageHeading>
      <section className="panel ranking-controls ranking-controls-expanded">
        <GroupPicker
          groups={catalog.data || []}
          index={groupIndex}
          onChange={(index) => {
            setGroupIndex(index);
            setPriority("");
          }}
        />
        <button
          className="button"
          disabled={!group}
          onClick={() => setPlan(true)}
        >
          <Settings2 size={16} />
          Задать места
        </button>
        {!demo && year === 2026 && (
          <button className="button" onClick={() => setReference(true)}>
            Места бакалавриата и специалитета 2026
          </button>
        )}
        {!demo && (
          <button
            className="button"
            disabled={!group || !rows.length}
            onClick={() => setOrder(true)}
          >
            Сформировать приказ
          </button>
        )}
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
                onClick={() => {
                  setQuota(key);
                  setPriority("");
                }}
              >
                {label}
                <span>{data?.lists[key]?.length || 0}</span>
              </button>
            ),
          )}
        </div>
        {!!rows.length && (
          <div className="filter-bar">
            <label className="field">
              Приоритет заявления
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="">Все приоритеты</option>
                {priorities.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {priority && (
              <span className="muted">
                Показано {filteredRows.length} из {rows.length}
              </span>
            )}
          </div>
        )}
        {error ? (
          <ErrorState error={error} />
        ) : loading || catalog.loading ? (
          <Busy />
        ) : !rows.length ? (
          <Empty
            title="В этой категории пока нет заявлений"
            text="Выберите другую конкурсную группу или категорию."
          />
        ) : !filteredRows.length ? (
          <Empty
            title="Нет заявлений с этим приоритетом"
            text="Выберите другой приоритет или сбросьте фильтр."
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
                {filteredRows.map((row) => (
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
          Для выгрузки ЕПГУ используется её итоговая сумма. При ручном вводе
          учитываются выбранные экзамены и индивидуальные достижения. При равной
          сумме система показывает одинаковое место.
        </div>
      </section>
      {person && (
        <ApplicantCard number={person} onClose={() => setPerson(null)} />
      )}
      {reference && <SeatReference onClose={() => setReference(false)} />}
      {order && group && (
        <OrderModal
          group={group}
          quota={quota}
          rows={rows}
          onClose={() => setOrder(false)}
        />
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

type SeatReferenceRow = {
  code: string;
  profile: string;
  study_form: string;
  seats: Record<Quota, number>;
};

function SeatReference({ onClose }: { onClose: () => void }) {
  const { data, loading, error } = useLoad<SeatReferenceRow[]>(
    "/reports/seat-reference",
  );
  const [form, setForm] = useState("Очная");
  const [filter, setFilter] = useState("");
  const categories = Object.keys(quotaLabels) as Quota[];
  const rows =
    data?.filter(
      (row) =>
        row.study_form === form &&
        (row.code + " " + row.profile)
          .toLowerCase()
          .includes(filter.toLowerCase().trim()),
    ) || [];
  return (
    <Modal
      title="Места бакалавриата и специалитета на 2026–2027 год"
      subtitle="Сведения БГТУ от 15.04.2026"
      onClose={onClose}
      wide
    >
      <div className="form-grid">
        <label className="field">
          Форма обучения
          <select
            value={form}
            onChange={(event) => setForm(event.target.value)}
          >
            {["Очная", "Очно-заочная", "Заочная"].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Код или профиль
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </div>
      {loading && <Busy />}
      {error && <ErrorState error={error} />}
      {!!data && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Код и профиль</th>
                {categories.map((quota) => (
                  <th key={quota}>{quotaLabels[quota]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code + row.profile}>
                  <th scope="row">
                    {row.code} · {row.profile}
                  </th>
                  {categories.map((quota) => (
                    <td key={quota}>{row.seats[quota]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="form-hint">
        Чтобы применить число к конкурсу, выберите конкурсную группу и
        воспользуйтесь кнопкой «Задать места».
      </p>
      <a
        className="button"
        href={
          (import.meta.env.DEV ? "/api" : "") +
          "/public/admission/documents/bachelor-seats"
        }
      >
        Бакалавриат · PDF
      </a>
      <a
        className="button"
        href={
          (import.meta.env.DEV ? "/api" : "") +
          "/public/admission/documents/specialist-seats"
        }
      >
        Специалитет · PDF
      </a>
    </Modal>
  );
}

function OrderModal({
  group,
  quota,
  rows,
  onClose,
}: {
  group: Group;
  quota: Quota;
  rows: Rank[];
  onClose: () => void;
}) {
  const { year, download, notify } = useStore();
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible = rows.filter(
    (row) =>
      ["participating", "accepted"].includes(row.status) &&
      (quota === "paid" ? row.paid_registered : row.consent),
  );
  return (
    <Modal
      title="Проект приказа о зачислении"
      subtitle={group.direction + " · " + quotaLabels[quota]}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setBusy(true);
          try {
            const fields = new FormData(event.currentTarget);
            await download(
              "/reports/enrollment-draft",
              "enrollment-draft.docx",
              jsonBody(
                {
                  year,
                  direction: group.direction,
                  campaign: group.campaign,
                  study_form: group.study_form,
                  quota,
                  ...Object.fromEntries(fields),
                  application_ids: selected,
                },
                "POST",
              ),
            );
            notify("Проект приказа сформирован");
          } catch (failure) {
            setError((failure as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Номер приказа
            <input name="order_number" required maxLength={100} />
          </label>
          <label className="field">
            Дата приказа
            <input name="order_date" type="date" required />
          </label>
          <label className="field">
            Дата зачисления
            <input name="enrolled_at" type="date" required />
          </label>
        </div>
        <p className="form-hint">
          Выберите абитуриентов. Скачивание проекта Word не меняет статусы
          заявлений.
        </p>
        <fieldset className="order-candidates">
          <legend>Кандидаты · выбрано {selected.length}</legend>
          {!eligible.length && (
            <p>
              {quota === "paid"
                ? "Нужен зарегистрированный оплаченный договор."
                : "Нет действующих заявлений с согласием на зачисление."}
            </p>
          )}
          {eligible.map((row) => (
            <label key={row.application_id}>
              <input
                type="checkbox"
                checked={selected.includes(row.application_id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, row.application_id]
                      : current.filter((id) => id !== row.application_id),
                  )
                }
              />
              {row.full_name} · {row.applicant_number} · {row.score} баллов
            </label>
          ))}
        </fieldset>
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button
            className="button primary"
            type="submit"
            disabled={busy || !selected.length}
          >
            {busy ? "Формирование…" : "Скачать проект Word"}
          </button>
        </div>
      </form>
    </Modal>
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
  const [seatValue, setSeatValue] = useState(String(seats ?? 0));
  const reference = useLoad<SeatReferenceRow[]>(
    year === 2026 ? "/reports/seat-reference" : null,
  );
  const matchingForm =
    reference.data?.filter(
      (row) => row.study_form.toLowerCase() === group.study_form.toLowerCase(),
    ) || [];
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
            value={seatValue}
            onChange={(event) => setSeatValue(event.target.value)}
            required
          />
        </label>
        {matchingForm.length > 0 && (
          <label className="field">
            Подставить из справочника
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value !== "")
                  setSeatValue(
                    String(
                      matchingForm[Number(event.target.value)].seats[quota],
                    ),
                  );
              }}
            >
              <option value="">Выберите соответствующий профиль</option>
              {matchingForm.map((row, index) => (
                <option value={index} key={row.code + row.profile}>
                  {row.code} · {row.profile} · {row.seats[quota]} мест
                </option>
              ))}
            </select>
          </label>
        )}
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
