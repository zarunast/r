import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { type Block } from "./Admission";

const normalize = (value: string) =>
  value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();

export default function Programs({ blocks }: { blocks: Block[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [form, setForm] = useState("");
  const [field, setField] = useState("");
  const groups = blocks.filter((block) => block.columns.length > 0);
  const programs = groups.flatMap(({ heading, rows }) =>
    rows
      .filter((row) => row[0]?.trim() && row[1]?.trim())
      .map((row) => {
        const [
          code,
          title,
          profile = "",
          forms = "",
          area = "",
          text = "",
          note = "",
        ] = row;
        return {
          level: heading,
          code,
          title,
          profile,
          forms: forms
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          area,
          text,
          note,
        };
      }),
  );
  const forms = [...new Set(programs.flatMap((program) => program.forms))].sort(
    (a, b) => a.localeCompare(b, "ru"),
  );
  const fields = [
    ...new Set(programs.map((program) => program.area).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const visible = programs.filter(
    (program) =>
      (!level || program.level === level) &&
      (!form || program.forms.includes(form)) &&
      (!field || program.area === field) &&
      tokens.every((token) =>
        normalize(
          `${program.code} ${program.title} ${program.profile}`,
        ).includes(token),
      ),
  );

  return (
    <>
      <div
        className="commission-filters program-filters"
        role="group"
        aria-label="Фильтры каталога"
      >
        <label>
          Поиск по коду, направлению или профилю
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например, 09.03.02"
          />
        </label>
        <label>
          Квалификация
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">Все квалификации</option>
            {groups.map(({ heading }) => (
              <option key={heading}>{heading}</option>
            ))}
          </select>
        </label>
        <label>
          Форма обучения
          <select
            value={form}
            onChange={(event) => setForm(event.target.value)}
          >
            <option value="">Все формы</option>
            {forms.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Область подготовки
          <select
            value={field}
            onChange={(event) => setField(event.target.value)}
          >
            <option value="">Все области</option>
            {fields.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setLevel("");
            setForm("");
            setField("");
          }}
        >
          Сбросить фильтры
        </button>
      </div>
      <p role="status">
        {visible.length
          ? `Найдено программ: ${visible.length}`
          : "По выбранным условиям программ нет."}
      </p>
      {level === "Аспирантура" && (
        <a href="https://www.tu-bryansk.ru/abitur/aspirant">
          Программы аспирантуры на сайте БГТУ{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      )}
      <div className="program-list">
        {visible.map(
          ({ code, title, profile, level, area, forms, text, note }, index) => (
            <article
              className="program-card"
              key={`${code}:${profile}:${index}`}
            >
              <p className="program-meta">
                {code} · {level}
                {area && ` · ${area}`}
              </p>
              <h2>{title}</h2>
              {profile && <p className="program-profile">{profile}</p>}
              <p className="program-forms">
                {forms.length
                  ? forms.join(", ")
                  : "Форму обучения уточняйте в БГТУ"}
              </p>
              {text && <p>{text}</p>}
              {note && <p className="program-note">{note}</p>}
            </article>
          ),
        )}
      </div>
    </>
  );
}
