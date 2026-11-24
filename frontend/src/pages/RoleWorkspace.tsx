import { useState } from "react";
import { AdmissionPage } from "../applicant-workspace/Admission";
import { jsonBody, useLoad, useStore } from "../store";

import { quotaLabels, type Quota } from "../types";

type PageEntry = { key: string; title: string; href: string };
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
        <>
          <p>
            <a
              className="button"
              href={entry.href}
              target="_blank"
              rel="noreferrer"
            >
              Открыть опубликованную страницу
            </a>
          </p>
          <AdmissionPage
            key={entry.key}
            id={entry.key}
            title={entry.title}
            editorToken={token}
          />
        </>
      )}
    </>
  );
}

type GradeRow = {
  id: number;
  number: string;
  name: string;
  direction: string;
  study_form: string;
  quota: string;
  subjects: string[][];
  exams: Record<string, number>;
  total_score: number;
  achievements: number;
  enrolled_at: string | null;
};

const standardSubjects = [
  "Русский язык",
  "Математика",
  "Информатика",
  "Механика",
  "Физика",
  "Обществознание",
  "Междисциплинарный экзамен",
  "Специальная дисциплина",
];

function GradebookRow({ row, columns }: { row: GradeRow; columns: string[] }) {
  const { api } = useStore();
  const [result, setResult] = useState(row);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const scores = { ...result.exams };
      for (const [name, value] of Object.entries(draft)) {
        if (!/^\d{1,3}$/.test(value) || Number(value) > 100)
          throw new Error("Укажите целое число от 0 до 100.");
        scores[name] = Number(value);
      }
      const saved = await api<Pick<GradeRow, "exams" | "total_score">>(
        `/exam-review/applications/${row.id}/scores`,
        jsonBody(
          {
            exam_scores: scores,
            previous_scores: result.exams,
            previous_total: result.total_score,
          },
          "PUT",
        ),
      );
      setResult({ ...result, ...saved });
      setDraft({});
      setStatus("Сохранено");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <th scope="row">
        {row.name}
        <small className="block muted">
          № {row.number} · {row.direction} · {row.study_form} ·{" "}
          {quotaLabels[row.quota as Quota] ?? row.quota}
        </small>
      </th>
      {columns.map((name) => {
        const allowed =
          row.subjects.length === 0 || row.subjects.flat().includes(name);
        return (
          <td key={name}>
            {allowed && !row.enrolled_at ? (
              <input
                aria-label={`${row.name} · ${name}`}
                type="number"
                min={0}
                max={100}
                value={draft[name] ?? result.exams[name] ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) => {
                    const next = { ...current };
                    if (value === "") delete next[name];
                    else next[name] = value;
                    return next;
                  });
                }}
                style={{ width: "5.25rem" }}
              />
            ) : (
              (result.exams[name] ?? "—")
            )}
          </td>
        );
      })}
      <td>{row.achievements}</td>
      <td>{result.total_score}</td>
      <td>
        {row.enrolled_at ? (
          "Зачислен"
        ) : (
          <button
            type="button"
            className="button"
            disabled={busy || !Object.keys(draft).length}
            onClick={save}
          >
            Сохранить
          </button>
        )}
        {status && (
          <small className="block" role="status">
            {status}
          </small>
        )}
      </td>
    </tr>
  );
}

function ExamReview() {
  const { year } = useStore();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { data, loading, error } = useLoad<{
    rows: GradeRow[];
    has_more: boolean;
  }>(
    `/exam-review/gradebook?${new URLSearchParams({ year: String(year), q: search, page: String(page) })}`,
  );
  const columns = [
    ...new Set(
      data?.rows.flatMap((row) => [
        ...(row.subjects.length ? row.subjects.flat() : standardSubjects),
        ...Object.keys(row.exams),
      ]),
    ),
  ];
  return (
    <section>
      <h2>Табель вступительных испытаний</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSearch(query.trim());
        }}
      >
        <label>
          ФИО или номер абитуриента
          <input
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit" className="button primary">
          Найти
        </button>
      </form>
      {loading && <p role="status">Загрузка табеля…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && data?.rows.length === 0 && <p>Заявлений не найдено.</p>}
      {!loading && !!data?.rows.length && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Абитуриент и программа</th>
                {columns.map((name) => (
                  <th key={name}>{name}</th>
                ))}
                <th>ИД</th>
                <th>Итого</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <GradebookRow key={row.id} row={row} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div aria-label="Страницы табеля">
        <button
          className="button"
          disabled={page === 0 || loading}
          onClick={() => setPage(page - 1)}
        >
          Назад
        </button>
        <span> Страница {page + 1} </span>
        <button
          className="button"
          disabled={!data?.has_more || loading}
          onClick={() => setPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </section>
  );
}

export function RoleWorkspace() {
  const { token, user, logout } = useStore();
  if (!token) return null;
  return (
    <main
      className={
        user.role_id === "examiner"
          ? "role-workspace gradebook"
          : "role-workspace"
      }
    >
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
            window.location.hash = "/login";
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
