import { useState, type FormEvent } from "react";
import { AdmissionPage } from "../applicant-workspace/Admission";
import { useLoad, useStore } from "../store";

type PageEntry = { key: string; title: string };
type Person = { number: string; name: string };
type ExamApplication = {
  id: number;
  year: number;
  campaign: string;
  direction: string;
  study_form: string;
  quota: string;
  exams: Record<string, number>;
  total_score: number;
  achievements: number;
  enrolled_at: string | null;
};
type RecordDetail = Person & { applications: ExamApplication[] };

function SiteEditor({ token }: { token: string }) {
  const { data, loading, error } = useLoad<PageEntry[]>(
    "/admission-content/pages",
  );
  const [selected, setSelected] = useState("");
  const entry = data?.find((page) => page.key === selected);
  return (
    <>
      {loading && <p role="status">Загрузка страниц…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <label>
          Страница сайта абитуриента
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Выберите страницу</option>
            {data.map(({ key, title }) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        </label>
      )}
      {entry && (
        <AdmissionPage
          key={entry.key}
          id={entry.key}
          title={entry.title}
          editorToken={token}
        />
      )}
    </>
  );
}

function Scores({
  application,
  onSave,
}: {
  application: ExamApplication;
  onSave: (result: Pick<ExamApplication, "exams" | "total_score">) => void;
}) {
  const { api } = useStore();
  const consistent =
    Object.values(application.exams).reduce(
      (sum, score) => sum + score,
      application.achievements,
    ) === application.total_score;
  const [rows, setRows] = useState(() =>
    Object.entries(application.exams).map(([name, score]) => ({
      name,
      score: String(score),
      selected: consistent,
    })),
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const included = rows.filter((row) => row.selected);
    const exams = Object.fromEntries(
      included.map(({ name, score }) => [name.trim(), Number(score)]),
    );
    if (
      !included.length ||
      Object.keys(exams).length !== included.length ||
      included.some(({ name, score }) => !name.trim() || !score.trim())
    ) {
      setError(
        "Выберите экзамены для конкурсной суммы. Укажите разные названия и заполните баллы.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await api<Pick<ExamApplication, "exams" | "total_score">>(
        `/exam-review/applications/${application.id}/scores`,
        {
          method: "PUT",
          body: JSON.stringify({
            exam_scores: exams,
            previous_scores: application.exams,
            previous_total: application.total_score,
          }),
        },
      );
      onSave(result);
      setStatus("Баллы сохранены.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function change(index: number, values: Partial<(typeof rows)[number]>) {
    setRows((current) =>
      current.map((row, position) =>
        position === index ? { ...row, ...values } : row,
      ),
    );
    setStatus("");
  }

  return (
    <form className="exam-score-form" onSubmit={submit}>
      <p>
        Конкурсная сумма: {application.total_score}. Индивидуальные достижения:{" "}
        {application.achievements}.
      </p>
      {application.enrolled_at ? (
        <>
          <p>Заявление зачислено.</p>
          <ul>
            {Object.entries(application.exams).map(([name, score]) => (
              <li key={name}>
                {name} · {score}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <fieldset disabled={busy}>
          <legend>Экзамены</legend>
          <p>
            Отметьте экзамены, которые должны войти в конкурсную сумму. Ранее
            сохранённые результаты останутся в карточке.
          </p>
          {rows.map((row, index) => (
            <div className="exam-score-row" key={index}>
              <label className="exam-score-check">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(event) =>
                    change(index, { selected: event.target.checked })
                  }
                />
                Включить в сумму
              </label>
              <label>
                Экзамен
                <input
                  value={row.name}
                  maxLength={120}
                  readOnly={Boolean(application.exams[row.name] !== undefined)}
                  onChange={(event) =>
                    change(index, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Баллы
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={row.score}
                  disabled={!row.selected}
                  onChange={(event) =>
                    change(index, { score: event.target.value })
                  }
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                { name: "", score: "", selected: true },
              ])
            }
          >
            Добавить экзамен
          </button>
          <button type="submit" className="button primary">
            Сохранить баллы
          </button>
        </fieldset>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function ExamReview() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [number, setNumber] = useState("");
  const matches = useLoad<Person[]>(
    search ? "/exam-review/applicants?q=" + encodeURIComponent(search) : null,
  );
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setNumber("");
          setSearch(query.trim());
        }}
      >
        <label>
          ФИО абитуриента
          <input
            required
            minLength={2}
            maxLength={200}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit" className="button primary">
          Найти
        </button>
      </form>
      {matches.loading && <p role="status">Поиск…</p>}
      {matches.error && <p role="alert">{matches.error}</p>}
      {matches.data?.length === 0 && search && <p>Абитуриенты не найдены.</p>}
      {matches.data && matches.data.length > 0 && (
        <ul className="exam-matches">
          {matches.data.map((person) => (
            <li key={person.number}>
              <button
                type="button"
                className="button"
                aria-pressed={number === person.number}
                onClick={() => setNumber(person.number)}
              >
                {person.name} · № {person.number}
              </button>
            </li>
          ))}
        </ul>
      )}
      {number && <ExamRecord key={number} number={number} />}
    </>
  );
}

function ExamRecord({ number }: { number: string }) {
  const { data, loading, error } = useLoad<RecordDetail>(
    "/exam-review/applicants/" + encodeURIComponent(number),
  );
  const [saved, setSaved] = useState<
    Record<number, Pick<ExamApplication, "exams" | "total_score">>
  >({});
  const [selected, setSelected] = useState<number>();
  const application =
    data?.applications.find(({ id }) => id === selected) ??
    data?.applications[0];
  return (
    <section className="exam-record" aria-label="Карточка абитуриента">
      {loading && <p role="status">Загрузка карточки…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <h2>{data.name}</h2>
          <p>Номер абитуриента: {data.number}</p>
          {application ? (
            <>
              <label>
                Заявление
                <select
                  value={application.id}
                  onChange={(event) => setSelected(Number(event.target.value))}
                >
                  {data.applications.map(
                    ({ id, year, direction, study_form, quota, campaign }) => (
                      <option key={id} value={id}>
                        {year} · {direction} · {campaign} · {study_form} ·{" "}
                        {quota}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <Scores
                key={application.id}
                application={{ ...application, ...saved[application.id] }}
                onSave={(result) =>
                  setSaved((current) => ({
                    ...current,
                    [application.id]: result,
                  }))
                }
              />
            </>
          ) : (
            <p>У абитуриента пока нет заявлений.</p>
          )}
        </>
      )}
    </section>
  );
}

export function RoleWorkspace() {
  const { token, user, logout } = useStore();
  if (!token) return null;
  return (
    <main className="role-workspace">
      <header className="role-workspace-header">
        <div>
          <h1>{user.role}</h1>
          <p>{user.display_name}</p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            logout();
            window.location.hash = "/login/" + user.role_id;
          }}
        >
          Выйти
        </button>
      </header>
      {user.role_id === "editor" ? (
        <SiteEditor token={token} />
      ) : (
        <ExamReview />
      )}
    </main>
  );
}
