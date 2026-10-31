import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Mail,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { jsonBody, useDebounce, useLoad, useStore } from "../store";
import {
  fullName,
  initials,
  numberFormat,
  params,
  quotaLabels,
  statusLabels,
  type Group,
  type Person,
  type PersonDetail,
  type Quota,
  type Result,
} from "../types";
import {
  Badge,
  Busy,
  Empty,
  ErrorState,
  Modal,
  PageHeading,
  Pagination,
  SaveButton,
} from "../components/ui";

export function Registry({ onImport }: { onImport: () => void }) {
  const { year } = useStore();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [quota, setQuota] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const query = useDebounce(search);
  const { data, loading, error } = useLoad<Result<Person>>(
    `/registry?${params({ year, q: query, direction, quota, status, offset, limit: 20 })}`,
  );
  const { data: groups } = useLoad<Group[]>(`/catalog/groups?year=${year}`);
  const reset = () => {
    setSearch("");
    setDirection("");
    setQuota("");
    setStatus("");
    setOffset(0);
  };
  return (
    <>
      <PageHeading
        title="Реестр абитуриентов"
        subtitle="Заявления, документы и вся информация о поступающих"
      >
        <button className="button" onClick={onImport}>
          Загрузить Excel
        </button>
        <button className="button primary" onClick={() => setAdding(true)}>
          <Plus size={17} />
          Добавить абитуриента
        </button>
      </PageHeading>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Поиск по ФИО или номеру абитуриента"
              aria-label="Поиск абитуриента"
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => {
                  setSearch("");
                  setOffset(0);
                }}
                aria-label="Очистить поиск"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <span className="filter-count">
            <UserRound size={15} />
            {numberFormat(data?.total || 0)} абитуриентов
          </span>
        </div>
        <div className="filter-options">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Направление"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Все направления</option>
            {[...new Set(groups?.map((g) => g.direction))].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Категория конкурса"
            value={quota}
            onChange={(e) => {
              setQuota(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Все категории</option>
            {Object.entries(quotaLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Статус заявления"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {(direction || quota || status || search) && (
            <button className="text-button muted" onClick={reset}>
              Сбросить
              <X size={14} />
            </button>
          )}
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : loading ? (
          <Busy />
        ) : !data?.items.length ? (
          <Empty
            title="Абитуриенты не найдены"
            text={
              search || direction || quota || status
                ? "Попробуйте изменить параметры поиска или сбросить фильтры."
                : "Загрузите Excel-выгрузку или добавьте первое заявление."
            }
          >
            <button
              className="button"
              onClick={
                search || direction || quota || status ? reset : onImport
              }
            >
              {search || direction || quota || status
                ? "Сбросить фильтры"
                : "Загрузить Excel"}
            </button>
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Абитуриент</th>
                  <th>Номер ЕПГУ</th>
                  <th>Контакты</th>
                  <th className="center">Заявлений</th>
                  <th>Лучший балл</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((person, i) => (
                  <tr key={person.number}>
                    <td>
                      <button
                        className="person-cell table-person"
                        onClick={() => setSelected(person.number)}
                      >
                        <span className={`avatar avatar-${i % 4}`}>
                          {initials(fullName(person))}
                        </span>
                        <span>
                          <strong>
                            {person.surname} {person.first_name}
                          </strong>
                          <small>{person.patronymic}</small>
                        </span>
                      </button>
                    </td>
                    <td className="mono muted">{person.number}</td>
                    <td>
                      <div className="table-two-lines">
                        <span>{person.phone || "Телефон не указан"}</span>
                        <small>{person.email || "Почта не указана"}</small>
                      </div>
                    </td>
                    <td className="center">
                      <span className="count-label">
                        {person.applications_count}
                      </span>
                    </td>
                    <td>
                      <span className="score-label">{person.best_score}</span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Открыть карточку: ${fullName(person)}`}
                        onClick={() => setSelected(person.number)}
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
        <Pagination
          total={data?.total || 0}
          offset={offset}
          limit={20}
          onChange={setOffset}
        />
      </section>
      {selected && (
        <ApplicantCard number={selected} onClose={() => setSelected(null)} />
      )}
      {adding && (
        <NewApplicant groups={groups || []} onClose={() => setAdding(false)} />
      )}
    </>
  );
}

export function ApplicantCard({
  number,
  onClose,
}: {
  number: string;
  onClose: () => void;
}) {
  const { data, loading, error } = useLoad<PersonDetail>(
    `/applicants/${encodeURIComponent(number)}`,
  );
  const [tab, setTab] = useState("profile");
  const [edit, setEdit] = useState(false);
  return (
    <Modal
      title="Карточка абитуриента"
      subtitle={`Номер ЕПГУ ${number}`}
      onClose={onClose}
      wide
    >
      {error ? (
        <ErrorState error={error} />
      ) : loading || !data ? (
        <Busy />
      ) : (
        <>
          <div className="applicant-hero">
            <span className="avatar avatar-large avatar-0">
              {initials(fullName(data))}
            </span>
            <div>
              <h3>{fullName(data)}</h3>
              <span className="muted">
                {data.applications.length} заявления · {data.contracts.length}{" "}
                договоров
              </span>
            </div>
            <button className="button small" onClick={() => setEdit(!edit)}>
              {edit ? "Отменить" : "Редактировать"}
            </button>
          </div>
          <div className="tabs">
            <button
              className={tab === "profile" ? "active" : ""}
              onClick={() => setTab("profile")}
            >
              Личные данные
            </button>
            <button
              className={tab === "applications" ? "active" : ""}
              onClick={() => setTab("applications")}
            >
              Заявления<span>{data.applications.length}</span>
            </button>
            <button
              className={tab === "documents" ? "active" : ""}
              onClick={() => setTab("documents")}
            >
              Документы
            </button>
          </div>
          {edit ? (
            <EditApplicant person={data} onDone={() => setEdit(false)} />
          ) : tab === "profile" ? (
            <dl className="detail-grid">
              <div>
                <dt>Фамилия</dt>
                <dd>{data.surname || "—"}</dd>
              </div>
              <div>
                <dt>Имя и отчество</dt>
                <dd>
                  {data.first_name} {data.patronymic}
                </dd>
              </div>
              <div>
                <dt>
                  <Phone size={14} />
                  Телефон
                </dt>
                <dd>{String(data.profile["Телефон"] || "Не указан")}</dd>
              </div>
              <div>
                <dt>
                  <Mail size={14} />
                  Электронная почта
                </dt>
                <dd>{String(data.profile["Почта"] || "Не указана")}</dd>
              </div>
              <div>
                <dt>Дата рождения</dt>
                <dd>{String(data.profile["Дата рождения"] || "Не указана")}</dd>
              </div>
              <div>
                <dt>СНИЛС</dt>
                <dd>{String(data.profile["СНИЛС"] || "Не указан")}</dd>
              </div>
            </dl>
          ) : tab === "applications" ? (
            <div className="application-cards">
              {data.applications.map((a) => (
                <div className="application-card" key={a.id}>
                  <div>
                    <h4>{a.direction}</h4>
                    <p>
                      {a.study_form} · {quotaLabels[a.quota]} · {a.year}
                    </p>
                    <Badge tone={a.status === "pending" ? "amber" : "blue"}>
                      {statusLabels[a.status] || a.status}
                    </Badge>
                  </div>
                  <div className="application-score">
                    <strong>{a.total_score}</strong>
                    <span>баллов</span>
                    <small>Приоритет {a.priority}</small>
                  </div>
                </div>
              ))}
              {!data.applications.length && (
                <Empty
                  title="Нет заявлений"
                  text="У этого абитуриента пока нет заявлений."
                />
              )}
            </div>
          ) : (
            <dl className="detail-list">
              {[
                "ДУЛ",
                "Серия",
                "Номер",
                "Дата выдачи",
                "Тип документа ОУ",
                "Организация, выдавшая документ ОУ",
                "Документы доп.",
              ].map((key) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(data.profile[key] || "Не указано")}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </Modal>
  );
}

function EditApplicant({
  person,
  onDone,
}: {
  person: PersonDetail;
  onDone: () => void;
}) {
  const { api, refresh, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api(
            `/applicants/${person.number}`,
            jsonBody(
              {
                surname: form.get("surname"),
                first_name: form.get("first_name"),
                patronymic: form.get("patronymic"),
                profile: {
                  Телефон: form.get("phone"),
                  Почта: form.get("email"),
                },
              },
              "PATCH",
            ),
          );
          refresh();
          notify("Карточка абитуриента обновлена");
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          Фамилия
          <input name="surname" defaultValue={person.surname} required />
        </label>
        <label className="field">
          Имя
          <input name="first_name" defaultValue={person.first_name} required />
        </label>
        <label className="field">
          Отчество
          <input name="patronymic" defaultValue={person.patronymic} />
        </label>
        <label className="field">
          Телефон
          <input
            name="phone"
            type="tel"
            defaultValue={String(person.profile["Телефон"] || "")}
          />
        </label>
        <label className="field">
          Электронная почта
          <input
            name="email"
            type="email"
            defaultValue={String(person.profile["Почта"] || "")}
          />
        </label>
      </div>
      {error && <ErrorState error={error} />}
      <div className="modal-footer">
        <SaveButton busy={busy} />
      </div>
    </form>
  );
}

function NewApplicant({
  groups,
  onClose,
}: {
  groups: Group[];
  onClose: () => void;
}) {
  const { api, year, refresh, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<Quota>("general");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const applicant = {
      number: String(f.get("number")),
      surname: f.get("surname"),
      first_name: f.get("first_name"),
      patronymic: f.get("patronymic"),
      profile: { Телефон: f.get("phone"), Почта: f.get("email") },
    };
    const application = {
      applicant_number: applicant.number,
      year,
      direction: f.get("direction"),
      campaign: f.get("campaign"),
      study_form: f.get("study_form"),
      quota,
      priority: 1,
      consent: f.get("consent") === "on",
      achievements: Number(f.get("achievements")),
      exam_scores: {
        "Русский язык": Number(f.get("russian")),
        Математика: Number(f.get("math")),
        "Предмет по выбору": Number(f.get("elective")),
      },
    };
    try {
      await api("/registry", jsonBody({ applicant, application }));
      refresh();
      notify("Абитуриент и заявление добавлены");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Новый абитуриент"
      subtitle={`Создание карточки и первого заявления · ${year}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form onSubmit={submit}>
        <h4 className="form-section-title">Личные данные</h4>
        <div className="form-grid">
          <label className="field">
            Номер абитуриента ЕПГУ
            <input
              name="number"
              placeholder="Например, 001234567"
              required
              pattern="[0-9A-Za-z_-]{1,64}"
              maxLength={64}
            />
          </label>
          <label className="field">
            Фамилия
            <input name="surname" required />
          </label>
          <label className="field">
            Имя
            <input name="first_name" required />
          </label>
          <label className="field">
            Отчество
            <input name="patronymic" />
          </label>
          <label className="field">
            Телефон
            <input name="phone" type="tel" placeholder="+7 (___) ___-__-__" />
          </label>
          <label className="field">
            Электронная почта
            <input name="email" type="email" placeholder="mail@example.ru" />
          </label>
        </div>
        <h4 className="form-section-title">Заявление</h4>
        <div className="form-grid">
          <label className="field field-full">
            Направление
            <input
              name="direction"
              list="directions"
              defaultValue={groups[0]?.direction}
              required
            />
            <datalist id="directions">
              {[...new Set(groups.map((g) => g.direction))].map((d) => (
                <option value={d} key={d} />
              ))}
            </datalist>
          </label>
          <label className="field">
            Кампания
            <select name="campaign">
              <option value="бак">Бакалавриат</option>
              <option value="маг">Магистратура</option>
              <option value="асп">Аспирантура</option>
            </select>
          </label>
          <label className="field">
            Форма обучения
            <select name="study_form">
              <option>Очная</option>
              <option>Очно-заочная</option>
              <option>Заочная</option>
            </select>
          </label>
          <label className="field field-full">
            Категория конкурса
            <select
              value={quota}
              onChange={(e) => setQuota(e.target.value as Quota)}
            >
              {Object.entries(quotaLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid form-grid-four">
          {[
            ["russian", "Русский язык"],
            ["math", "Математика"],
            ["elective", "По выбору"],
            ["achievements", "Баллы ИД"],
          ].map(([name, label]) => (
            <label className="field" key={name}>
              {label}
              <input
                name={name}
                type="number"
                min={0}
                max={100}
                defaultValue={0}
                required
              />
            </label>
          ))}
        </div>
        <label className="checkbox-field">
          <input name="consent" type="checkbox" />
          <Check size={15} />
          Согласие на зачисление получено
        </label>
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </button>
          <SaveButton busy={busy} label="Добавить абитуриента" />
        </div>
      </form>
    </Modal>
  );
}
