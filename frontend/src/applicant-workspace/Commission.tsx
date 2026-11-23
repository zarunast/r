import { useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import {
  eventDetails,
  newsDetails,
  questions,
  reviews,
} from "./commission-data";
import { events, news, official } from "./sections";
import { AdmissionPage } from "./Admission";

const university = "https://www.tu-bryansk.ru/";
const feedback = official + "feedback/";
const maps =
  "https://yandex.ru/maps/?text=" +
  encodeURIComponent("Брянск, Харьковская улица, 10Б");
const address =
  "Брянск, Бежицкий район, ул. Харьковская, 10Б, учебный корпус № 4, 2-й этаж, аудитория Б201";
const dateLabel = (date: string) => date.split("-").reverse().join(".");

function Phones() {
  return (
    <ul className="commission-phones">
      <li>
        <a href="tel:+74832588264">+7 (4832) 58-82-64</a>
      </li>
      <li>
        <a href="tel:+74832510357">+7 (4832) 51-03-57</a>
      </li>
      <li>
        Горячая линия <a href="tel:+79206048804">+7 (920) 604-88-04</a>
      </li>
    </ul>
  );
}

function ContactPage() {
  return (
    <>
      <h2>Адрес приёмной комиссии</h2>
      <p>{address}</p>
      <a href={maps}>
        <MapPin size={17} aria-hidden="true" /> Открыть в Яндекс Картах
      </a>
      <h2>Телефоны и электронная почта</h2>
      <Phones />
      <p>
        <a href="mailto:pk@tu-bryansk.ru">pk@tu-bryansk.ru</a>
      </p>
      <p>
        <a href={university}>Официальный сайт университета</a>
      </p>
      <h2>Адрес для корреспонденции</h2>
      <p>
        Российская Федерация, 241035, г. Брянск, бульвар 50 лет Октября, дом 7,
        Брянский государственный технический университет.
      </p>
    </>
  );
}

function Preparation() {
  return (
    <>
      <p>
        БГТУ ежегодно организует платные подготовительные курсы к ЕГЭ и
        внутренним вступительным испытаниям. Продолжительность зависит от
        программы.
      </p>
      <h2>Куда обращаться</h2>
      <p>
        Расписание, стоимость и условия записи уточняйте в управлении
        профориентации, подготовки и набора абитуриентов.
      </p>
      <p>{address}.</p>
      <Phones />
      <p>
        <a href={official + "page/before-training.html"}>
          Подготовительные курсы на сайте БГТУ{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </p>
    </>
  );
}

function Feedback({ review }: { review: boolean }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const entries = (review ? reviews : questions).filter(
    (entry) =>
      entry.name
        .toLocaleLowerCase("ru")
        .includes(name.trim().toLocaleLowerCase("ru")) &&
      (!date || entry.date === date),
  );

  return (
    <>
      <p>
        <a href={feedback + (review ? "?category=review" : "")}>
          {review
            ? "Оставить отзыв на сайте БГТУ"
            : "Задать вопрос на сайте БГТУ"}{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </p>
      <div className="commission-filters">
        <label>
          Поиск по имени
          <input
            type="search"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Дата публикации
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <p role="status">Найдено записей: {entries.length}</p>
      {entries.map((entry) => (
        <article className="commission-entry" key={entry.date}>
          <header>
            <h2>{entry.name}</h2>
            <time dateTime={entry.date}>{dateLabel(entry.date)}</time>
          </header>
          <p>{entry.text}</p>
          {entry.answer && (
            <p>
              <strong>Ответ.</strong> {entry.answer}
            </p>
          )}
        </article>
      ))}
    </>
  );
}

const months = new Intl.DateTimeFormat("ru", {
  month: "long",
  timeZone: "UTC",
});

function Publications({ isNews }: { isNews: boolean }) {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [active, setActive] = useState(false);
  const entries = isNews ? news : events;
  const years = [...new Set(entries.map(([date]) => date.slice(0, 4)))];
  const result = entries.filter(([date]) => {
    const deadline = newsDetails[date]?.deadline;
    return (
      (!year || date.startsWith(year)) &&
      (!month || Number(date.slice(5, 7)) === Number(month)) &&
      (!active || (deadline && Date.parse(deadline) >= Date.now()))
    );
  });
  return (
    <>
      <div className="commission-filters">
        <label>
          Месяц
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value="">Все месяцы</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index + 1}>
                {months.format(new Date(Date.UTC(2026, index, 1)))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Год
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">Все годы</option>
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {isNews && (
          <label className="commission-checkbox">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />{" "}
            Только актуальные
          </label>
        )}
      </div>
      <p role="status">
        {result.length
          ? `Найдено публикаций: ${result.length}`
          : "Публикаций по выбранным условиям нет."}
      </p>
      {result.map(([date, title]) => {
        const description = isNews
          ? newsDetails[date]?.text
          : eventDetails[date];
        return (
          <article className="commission-entry" key={date}>
            <header>
              <h2>{title}</h2>
              <time dateTime={date}>{dateLabel(date)}</time>
            </header>
            {description && <p>{description}</p>}
          </article>
        );
      })}
      <p>
        <a href={official + (isNews ? "news/" : "events/")}>
          {isNews ? "Все новости" : "Все события"} на сайте БГТУ{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </p>
    </>
  );
}

const pages = {
  contacts: ContactPage,
  preparation: Preparation,
  faq: () => <Feedback review={false} />,
  graduates: () => <Feedback review />,
  news: () => <Publications isNews />,
  events: () => <Publications isNews={false} />,
};

export default function Commission({
  pageId,
  links,
}: {
  pageId?: string;
  links: readonly (readonly [string, string, string?])[];
}) {
  const active = links.find(([id]) => id === pageId) ?? links[0];
  const Content = pages[active[0] as keyof typeof pages];
  return (
    <div className="commission-layout">
      <nav className="commission-nav" aria-label="Приёмная комиссия">
        {links.map(([id, title]) => (
          <a
            key={id}
            href={"#/commission/" + id}
            aria-current={id === active[0] ? "page" : undefined}
          >
            {title}
          </a>
        ))}
      </nav>
      {active[0] === "contacts" ? (
        <AdmissionPage id="commission-contacts" title={active[1]}>
          <ContactPage />
        </AdmissionPage>
      ) : (
        <section
          className="interior commission-body"
          aria-labelledby="commission-title"
        >
          <h1 id="commission-title">{active[1]}</h1>
          <Content />
        </section>
      )}
    </div>
  );
}
