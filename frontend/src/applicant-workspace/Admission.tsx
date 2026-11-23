import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { official, programs, type Section } from "./sections";
import Rankings from "./Rankings";

const api = import.meta.env.DEV ? "/api" : "";
const gov = "https://www.gosuslugi.ru/vuzonline";
const pageSources: Record<string, string> = {
  international: official + "cpage/20.htm",
  accessibility: official + "cpage/21.htm",
  internal: official + "cpage/686.htm?filter=y",
  housing: official + "page/hostel.htm",
  scholarships: official + "page/456.htm",
  activities: official + "page/426.htm",
  council: official + "page/450.htm",
  federal: official + "cpage/157.htm",
  programs: official + "specialty/",
  rules: official + "cpage/643.htm",
  bachelor: official + "cpage/644.htm",
  postgraduate: "https://www.tu-bryansk.ru/abitur/aspirant",
  college: "https://www.tu-bryansk.ru/abitur/college",
  quota: official + "page/18460.htm",
  "undergraduate-tests": official + "cpage/646.htm",
  master: official + "cpage/645.htm",
  "graduate-tests": official + "cpage/647.htm",
};

export type Block = {
  heading: string;
  text: string;
  columns: string[];
  rows: string[][];
  documents: string[];
};
type Page = { title: string; revision: number; blocks: Block[] };
type Media = { key: string; caption: string; mime_type: string };
type Content = {
  page: Page;
  documents: Record<string, string>;
  available_documents: string[];
  media: Media[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(api + path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : "Не удалось выполнить запрос. Проверьте введённые данные и подключение.",
    );
  }
  return response.json() as Promise<T>;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Повторите попытку.";
}

function DownloadList({
  keys,
  documents,
  available,
}: {
  keys: string[];
  documents: Content["documents"];
  available: string[];
}) {
  return (
    <ul className="admission-downloads">
      {keys.map((key) => (
        <li key={key}>
          {available.includes(key) ? (
            <a href={api + "/public/admission/documents/" + key}>
              <Download size={17} aria-hidden="true" /> {documents[key]}{" "}
              <small>PDF</small>
            </a>
          ) : (
            <span>
              {documents[key]} <small>PDF пока не загружен</small>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function linkedText(text: string) {
  return text
    .split(
      /(https?:\/\/[^\s<>"«»]+[^\s<>"«».,;:!?)]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    )
    .map((part, index) => {
      if (index % 2 === 0) return part;
      const href = /^https?:\/\//i.test(part) ? part : "mailto:" + part;
      return (
        <a key={index} href={href}>
          {part}
        </a>
      );
    });
}

function BlockView({
  block,
  documents,
  available,
}: {
  block: Block;
  documents: Content["documents"];
  available: string[];
}) {
  return (
    <section className="admission-block">
      {block.heading && <h2>{block.heading}</h2>}
      {block.text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => {
          const emphasis = /^\*\*(.+)\*\*$/.exec(paragraph.trim());
          return (
            <p className="admission-paragraph" key={index}>
              {emphasis ? (
                <strong>{linkedText(emphasis[1])}</strong>
              ) : (
                linkedText(paragraph)
              )}
            </p>
          );
        })}
      {block.columns.length > 0 && (
        <div
          className="admission-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={block.heading || "Таблица"}
        >
          <table
            className="commission-hours"
            aria-label={block.heading || "Данные приёма"}
          >
            <thead>
              <tr>
                {block.columns.map((column, index) => (
                  <th key={index} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) =>
                    column === 0 ? (
                      <th key={column} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={column}>{linkedText(cell)}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {block.documents.length > 0 && (
        <DownloadList
          keys={block.documents}
          documents={documents}
          available={available}
        />
      )}
    </section>
  );
}

function PageEditor({
  saved,
  onSave,
  documents,
}: {
  saved: Page;
  onSave: (page: Page) => Promise<Page>;
  documents: Content["documents"];
}) {
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function updateBlock(index: number, patch: Partial<Block>) {
    setDraft((previous) => ({
      ...previous,
      blocks: previous.blocks.map((block, position) =>
        position === index ? { ...block, ...patch } : block,
      ),
    }));
    setStatus("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      setDraft(await onSave(draft));
      setStatus("Изменения опубликованы.");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admission-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Содержание страницы</legend>
        <label>
          Заголовок страницы
          <input
            required
            maxLength={240}
            value={draft.title}
            onChange={(event) => {
              setDraft({ ...draft, title: event.target.value });
              setStatus("");
            }}
          />
        </label>
        {draft.blocks.map((block, index) => (
          <details className="admission-edit-block" key={index}>
            <summary>{block.heading || `Блок ${index + 1}`}</summary>
            <label>
              Заголовок блока
              <input
                maxLength={220}
                value={block.heading}
                onChange={(event) =>
                  updateBlock(index, { heading: event.target.value })
                }
              />
            </label>
            <label>
              Текст блока
              <textarea
                rows={5}
                maxLength={10000}
                value={block.text}
                onChange={(event) =>
                  updateBlock(index, { text: event.target.value })
                }
              />
            </label>
            <label>
              Прикрепить документ
              <select
                value=""
                onChange={(event) => {
                  const key = event.target.value;
                  if (key)
                    updateBlock(index, {
                      documents: [...block.documents, key],
                    });
                }}
              >
                <option value="">Выбрать документ</option>
                {Object.entries(documents)
                  .filter(([key]) => !block.documents.includes(key))
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            {block.documents.map((key) => (
              <div key={key}>
                {documents[key]}{" "}
                <button
                  type="button"
                  onClick={() =>
                    updateBlock(index, {
                      documents: block.documents.filter((item) => item !== key),
                    })
                  }
                >
                  Убрать ссылку
                </button>
              </div>
            ))}
            {block.columns.map((column, columnIndex) => (
              <label key={columnIndex}>
                Название столбца {columnIndex + 1}
                <input
                  maxLength={1500}
                  value={column}
                  onChange={(event) =>
                    updateBlock(index, {
                      columns: block.columns.map((value, position) =>
                        position === columnIndex ? event.target.value : value,
                      ),
                    })
                  }
                />
              </label>
            ))}
            {block.rows.map((row, rowIndex) => (
              <fieldset className="admission-edit-row" key={rowIndex}>
                <legend>Строка {rowIndex + 1}</legend>
                {row.map((cell, columnIndex) => (
                  <label key={columnIndex}>
                    {block.columns[columnIndex] || `Столбец ${columnIndex + 1}`}
                    <textarea
                      rows={2}
                      maxLength={1500}
                      value={cell}
                      onChange={(event) =>
                        updateBlock(index, {
                          rows: block.rows.map((cells, position) =>
                            position === rowIndex
                              ? cells.map((value, column) =>
                                  column === columnIndex
                                    ? event.target.value
                                    : value,
                                )
                              : cells,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  aria-label={`Удалить строку ${rowIndex + 1}`}
                  onClick={() =>
                    updateBlock(index, {
                      rows: block.rows.filter(
                        (_, position) => position !== rowIndex,
                      ),
                    })
                  }
                >
                  Удалить строку
                </button>
              </fieldset>
            ))}
            {block.columns.length > 0 && (
              <button
                type="button"
                disabled={block.rows.length >= 60}
                onClick={() =>
                  updateBlock(index, {
                    rows: [...block.rows, block.columns.map(() => "")],
                  })
                }
              >
                Добавить строку
              </button>
            )}
          </details>
        ))}
        <button
          type="button"
          disabled={draft.blocks.length >= 24}
          onClick={() =>
            setDraft((previous) => ({
              ...previous,
              blocks: [
                ...previous.blocks,
                { heading: "", text: "", columns: [], rows: [], documents: [] },
              ],
            }))
          }
        >
          Добавить текстовый блок
        </button>
        <button type="submit" className="primary">
          {busy ? "Сохранение…" : "Опубликовать изменения"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </form>
  );
}

function DocumentEditor({
  documents,
  keys,
  token,
  available,
  onUpload,
}: {
  documents: Content["documents"];
  keys: string[];
  token: string;
  available: string[];
  onUpload: (key: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const key = String(data.get("document"));
    data.delete("document");
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await request("/admission-content/documents/" + key, {
        method: "PUT",
        body: data,
        headers: { Authorization: "Bearer " + token },
      });
      form.reset();
      setStatus(
        available.includes(key)
          ? `Файл «${documents[key]}» заменён. Ссылка для скачивания сохранилась.`
          : `Файл «${documents[key]}» опубликован.`,
      );
      onUpload(key);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admission-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Загрузка и замена PDF</legend>
        <label htmlFor="admission-document">Документ</label>
        <select id="admission-document" name="document">
          {keys.map((key) => (
            <option key={key} value={key}>
              {documents[key]}
              {available.includes(key) ? "" : " (PDF пока не загружен)"}
            </option>
          ))}
        </select>
        <label>
          Новый PDF (до 24 МиБ)
          <input
            name="file"
            type="file"
            accept=".pdf,application/pdf"
            required
          />
        </label>
        <button type="submit" className="primary">
          {busy
            ? "Загрузка…"
            : keys.every((key) => available.includes(key))
              ? "Заменить PDF"
              : "Загрузить или заменить PDF"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </form>
  );
}

function MediaEditor({
  id,
  items,
  token,
  onPublish,
  onRemove,
}: {
  id: string;
  items: Media[];
  token: string;
  onPublish: (item: Media) => void;
  onRemove: (key: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const path = `/admission-content/pages/${id}/media`;

  async function changeMedia(action: () => Promise<void>, success: string) {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await action();
      setStatus(success);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void changeMedia(async () => {
      const item = await request<Media>(path, {
        method: "POST",
        body: new FormData(form),
        headers: { Authorization: "Bearer " + token },
      });
      onPublish(item);
      form.reset();
    }, "Материал опубликован.");
  }

  function remove(item: Media) {
    if (!window.confirm(`Удалить материал «${item.caption}» со страницы?`))
      return;
    void changeMedia(async () => {
      await request(path + "/" + item.key, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      onRemove(item.key);
    }, "Материал удалён.");
  }

  return (
    <form className="admission-form" onSubmit={publish}>
      <fieldset disabled={busy}>
        <legend>Фото и видео</legend>
        <label>
          Подпись к материалу
          <input name="caption" maxLength={240} required />
        </label>
        <label>
          Фото JPEG, PNG, WebP до 10 МиБ или видео MP4, WebM до 64 МиБ
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            required
          />
        </label>
        <button type="submit" className="primary">
          {busy ? "Сохранение…" : "Опубликовать материал"}
        </button>
        {items.length > 0 && (
          <ul className="admission-media-list">
            {items.map((item) => (
              <li key={item.key}>
                <span>{item.caption}</span>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`Удалить материал «${item.caption}»`}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </form>
  );
}

function MediaGallery({ items }: { items: Media[] }) {
  if (!items.length) return null;
  return (
    <section className="admission-block">
      <h2>Фото и видео</h2>
      <div className="admission-gallery">
        {items.map((item) => {
          const src = api + "/public/admission/media/" + item.key;
          return (
            <figure key={item.key}>
              {item.mime_type.startsWith("image/") ? (
                <a href={src} aria-label={`Открыть фото «${item.caption}»`}>
                  <img src={src} alt={item.caption} loading="lazy" />
                </a>
              ) : (
                <video
                  src={src}
                  controls
                  playsInline
                  preload="none"
                  aria-label={item.caption}
                />
              )}
              <figcaption>{item.caption}</figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

export function AdmissionPage({
  id,
  title,
  editorToken,
  children,
  renderTables,
}: {
  id: string;
  renderTables?: (blocks: Block[]) => ReactNode;
  children?: ReactNode;
  title: string;
  editorToken?: string;
}) {
  const [content, setContent] = useState<Content | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request<Content>("/public/admission/pages/" + id, {
      signal: controller.signal,
    })
      .then(setContent)
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(message(error));
      });
    return () => controller.abort();
  }, [id, attempt]);

  async function save(page: Page) {
    if (!editorToken) throw new Error("Войдите как сотрудник.");
    const updated = await request<Page>("/admission-content/pages/" + id, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + editorToken,
      },
      body: JSON.stringify(page),
    });
    setContent((previous) => previous && { ...previous, page: updated });
    return updated;
  }

  const documentKeys = content
    ? [...new Set(content.page.blocks.flatMap((block) => block.documents))]
    : [];
  return (
    <section
      className={
        id === "graduate-tests"
          ? "interior commission-body graduate-schedule"
          : "interior commission-body"
      }
    >
      <h1>{content?.page.title ?? title}</h1>
      {children}
      {loadError ? (
        <div>
          <p role="alert">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError("");
              setAttempt(attempt + 1);
            }}
          >
            Повторить
          </button>
        </div>
      ) : !content ? (
        <p role="status">Загрузка…</p>
      ) : (
        <>
          {editorToken ? (
            <div className="admission-editor">
              <PageEditor
                saved={content.page}
                onSave={save}
                documents={content.documents}
              />
              <MediaEditor
                id={id}
                items={content.media}
                token={editorToken}
                onPublish={(item) =>
                  setContent(
                    (previous) =>
                      previous && {
                        ...previous,
                        media: [...previous.media, item],
                      },
                  )
                }
                onRemove={(key) =>
                  setContent(
                    (previous) =>
                      previous && {
                        ...previous,
                        media: previous.media.filter(
                          (item) => item.key !== key,
                        ),
                      },
                  )
                }
              />
              {documentKeys.length > 0 && (
                <DocumentEditor
                  documents={content.documents}
                  keys={documentKeys}
                  token={editorToken}
                  available={content.available_documents}
                  onUpload={(key) =>
                    setContent((previous) =>
                      previous && !previous.available_documents.includes(key)
                        ? {
                            ...previous,
                            available_documents: [
                              ...previous.available_documents,
                              key,
                            ],
                          }
                        : previous,
                    )
                  }
                />
              )}
            </div>
          ) : (
            <>
              {id === "graduate-tests" && (
                <p className="graduate-schedule-actions">
                  <button type="button" onClick={() => window.print()}>
                    Распечатать или сохранить в PDF
                  </button>{" "}
                  <a href="#/admission/master">Общие сведения о магистратуре</a>
                </p>
              )}
              {renderTables?.(content.page.blocks)}
              {content.page.blocks.map((block, index) =>
                renderTables && block.columns.length ? null : (
                  <BlockView
                    key={index}
                    block={block}
                    documents={content.documents}
                    available={content.available_documents}
                  />
                ),
              )}
              <MediaGallery items={content.media} />
              <ul className="admission-downloads">
                <li>
                  <a href={pageSources[id] || official}>
                    {id === "postgraduate"
                      ? "Приём в аспирантуру БГТУ"
                      : id === "college"
                        ? "Приёмная комиссия Политехнического колледжа БГТУ"
                        : "Информация на сайте БГТУ"}{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </li>
                {id === "international" && (
                  <>
                    <li>
                      <a href={programs}>
                        Каталог специальностей и направлений
                      </a>
                    </li>
                    <li>
                      <a href="#/admission/bachelor">
                        Условия приёма на бакалавриат и специалитет
                      </a>
                    </li>
                    <li>
                      <a href="#/admission/master">
                        Условия приёма в магистратуру
                      </a>
                    </li>
                  </>
                )}
                {id === "internal" && (
                  <li>
                    <a href="#/student-life/housing">
                      Сведения об общежитиях БГТУ
                    </a>
                  </li>
                )}
                {id === "federal" && (
                  <li>
                    <a href="https://pravo.gov.ru/">
                      Официальный интернет-портал правовой информации
                    </a>
                  </li>
                )}
                {id === "target" && (
                  <>
                    <li>
                      <a href="https://minobrnauki.gov.ru/action/targeted_training/">
                        Разъяснения и методические рекомендации Минобрнауки
                        России
                      </a>
                    </li>
                    <li>
                      <a href="https://trudvsem.ru/">
                        Платформа «Работа в России»
                      </a>
                    </li>
                  </>
                )}
                {(id === "rules" || id === "bachelor") && (
                  <>
                    <li>
                      <a href={gov}>
                        Поступление в вуз онлайн{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </a>
                    </li>
                    <li>
                      <a href="#/commission/contacts">
                        Контакты приёмной комиссии
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default function Admission({
  pageId,
  links,
  sectionId = "admission",
  sectionTitle = "Приём 2026",
}: {
  pageId?: string;
  sectionId?: string;
  sectionTitle?: string;
  links: Section["pages"];
}) {
  const [id, title] =
    links.find(([key, , href]) => key === pageId && !href) ?? links[0];

  return (
    <div className="commission-layout">
      <nav className="commission-nav" aria-label={sectionTitle}>
        {links.map(([key, label, href]) => (
          <a
            key={key}
            href={href || `#/${sectionId}/${key}`}
            aria-current={key === id ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      {id === "rankings" ? (
        <Rankings />
      ) : (
        <AdmissionPage key={id} id={id} title={title} />
      )}
    </div>
  );
}
