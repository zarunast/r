import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import "@fontsource/inter/cyrillic-400.css";
import "@fontsource/inter/cyrillic-600.css";
import "@fontsource/inter/cyrillic-700.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import {
  events,
  news,
  official,
  programs,
  rankings,
  sections,
} from "./sections";
import Commission from "./Commission";
import Admission, { AdmissionPage } from "./Admission";
import Programs from "./Programs";
import "./workspace.css";
import { Assistant } from "../portal/Assistant";

const map =
  "https://yandex.ru/maps/?text=" +
  encodeURIComponent("Брянск, Харьковская улица, 10Б");
const readRoute = () => window.location.hash.slice(1);
const sectionLink = (id: string) => "#/" + id;

function Contacts() {
  return (
    <section
      className="contacts"
      id="contacts"
      aria-labelledby="contacts-title"
    >
      <div>
        <h2 id="contacts-title">Приёмная комиссия</h2>
        <div className="contact-detail">
          <Clock3 aria-hidden="true" />
          <div>
            <strong>В период приёма документов</strong>
            <p>
              Пн–пт 10:00–18:00, перерыв 13:00–14:00
              <br />
              Сб 9:00–14:00
            </p>
          </div>
        </div>
        <div className="contact-detail">
          <Phone aria-hidden="true" />
          <div>
            <a href="tel:+74832510357">+7 (4832) 51-03-57</a>
            <br />
            <a href="tel:+74832588264">+7 (4832) 58-82-64</a>
            <br />
            <a href="tel:+79206048804">Горячая линия +7 (920) 604-88-04</a>
          </div>
        </div>
        <div className="contact-detail">
          <Mail aria-hidden="true" />
          <a href="mailto:pk@tu-bryansk.ru">pk@tu-bryansk.ru</a>
        </div>
      </div>
      <div className="location">
        <MapPin size={38} aria-hidden="true" />
        <h3>Харьковская, 10Б</h3>
        <p>
          Брянск, учебный корпус № 4<br />
          2-й этаж, аудитория Б201
        </p>
        <a href={map}>
          Открыть в Яндекс Картах <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function Updates({
  title,
  entries,
  id,
}: {
  title: string;
  entries: readonly (readonly [string, string])[];
  id: string;
}) {
  return (
    <section className="updates" id={id} aria-labelledby={id + "-title"}>
      <div className="section-heading">
        <h2 id={id + "-title"}>{title}</h2>
        <a href={official}>
          На сайте БГТУ <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <ul>
        {entries.map(([date, label]) => (
          <li key={date}>
            <time dateTime={date}>
              <CalendarDays size={16} aria-hidden="true" />
              {date.split("-").reverse().join(".")}
            </time>
            <h3>{label}</h3>
          </li>
        ))}
      </ul>
    </section>
  );
}

function App() {
  const [route, setRoute] = useState(readRoute);
  const [menu, setMenu] = useState("");
  const [chat, setChat] = useState(false);
  const [largeText, setLargeText] = useState(false);
  useEffect(() => {
    const update = () => {
      const next = readRoute();
      setRoute(next);
      setMenu("");
      if (next.startsWith("/")) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const [sectionId, pageId] = route.startsWith("/")
    ? route.slice(1).split("/")
    : [];
  const section = sections.find(({ id }) => id === sectionId);
  const page = section?.pages.find(([id]) => id === pageId);

  return (
    <div className={largeText ? "site large-text" : "site"}>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        К содержанию
      </a>
      <header className="shell">
        <div className="masthead">
          <a
            className="brand"
            href={sectionLink("")}
            onClick={() => setMenu("")}
          >
            <span className="brand-icon">
              <GraduationCap size={27} aria-hidden="true" />
            </span>
            <span>
              <strong>Абитуриенту БГТУ</strong>
              <small>Брянский государственный технический университет</small>
            </span>
          </a>
          <div className="masthead-actions">
            <a href="tel:+74832510357">
              <Phone size={16} aria-hidden="true" /> +7 (4832) 51-03-57
            </a>
            <button
              type="button"
              aria-pressed={largeText}
              onClick={() => setLargeText(!largeText)}
            >
              Крупный текст
            </button>
          </div>
        </div>
        <nav
          className="navigation"
          aria-label="Разделы портала"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenu("");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !menu) return;
            document.getElementById("toggle-" + menu)?.focus();
            setMenu("");
          }}
        >
          {sections.map(({ id, title, pages }) => (
            <div className="nav-item" key={id}>
              {pages.length ? (
                <button
                  id={"toggle-" + id}
                  type="button"
                  aria-expanded={menu === id}
                  aria-controls={"menu-" + id}
                  className={sectionId === id ? "selected" : undefined}
                  onClick={() => setMenu(menu === id ? "" : id)}
                >
                  {title} <ChevronDown size={15} aria-hidden="true" />
                </button>
              ) : (
                <a
                  href={sectionLink(id)}
                  aria-current={sectionId === id ? "page" : undefined}
                >
                  {title}
                </a>
              )}
              {pages.length > 0 && (
                <ul id={"menu-" + id} hidden={menu !== id}>
                  {pages.map(([key, label, href]) => (
                    <li key={key}>
                      <a
                        href={href || sectionLink(id + "/" + key)}
                        onClick={() => setMenu("")}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </header>

      <main className="shell" id="main" tabIndex={-1}>
        {section ? (
          <>
            <div className="breadcrumb">
              <a href={sectionLink("")}>Главная</a>
              <span>/</span>
              {section.title}
            </div>
            {sectionId === "commission" ? (
              <Commission pageId={pageId} links={section.pages} />
            ) : sectionId === "admission" ? (
              <Admission
                key={sectionId}
                pageId={pageId}
                links={section.pages}
              />
            ) : sectionId === "documents" || sectionId === "student-life" ? (
              <Admission
                key={sectionId}
                pageId={pageId}
                links={section.pages}
                sectionId={sectionId}
                sectionTitle={section.title}
              />
            ) : sectionId === "programs" ? (
              <AdmissionPage
                key="programs"
                id="programs"
                title={section.title}
                renderTables={(blocks) => <Programs blocks={blocks} />}
              />
            ) : sectionId === "international" ||
              sectionId === "accessibility" ? (
              <AdmissionPage
                key={sectionId}
                id={sectionId}
                title={section.title}
              >
                <ul
                  className="admission-downloads"
                  aria-label="Помощь при поступлении"
                >
                  {sectionId === "international" && (
                    <li>
                      <a href="tel:+74832588391">
                        Центр международного сотрудничества · +7 (4832) 58-83-91
                      </a>
                    </li>
                  )}
                  <li>
                    <a href="#/commission/contacts">
                      Контакты приёмной комиссии
                    </a>
                  </li>
                  <li>
                    <a href="#/commission/faq">Вопрос-ответ</a>
                  </li>
                </ul>
              </AdmissionPage>
            ) : (
              <section className="interior">
                <h1>{page?.[1] || section.title}</h1>
                <a className="primary" href={official}>
                  Информация на сайте БГТУ{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="intro">
              <section className="hero" aria-labelledby="hero-title">
                <div className="hero-copy">
                  <p className="eyebrow">Приёмная кампания 2026</p>
                  <h1 id="hero-title">
                    Поступление
                    <br />в БГТУ
                  </h1>
                  <p>
                    Выберите направление, подготовьте документы и следите за
                    своим местом в конкурсном списке.
                  </p>
                  <a className="primary" href={programs}>
                    Выбрать направление{" "}
                    <ArrowRight size={18} aria-hidden="true" />
                  </a>
                </div>
              </section>
              <aside className="quick">
                <h2>Быстрый доступ</h2>
                <a href={rankings}>
                  Списки поступающих{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <a href={sectionLink("commission/events")}>
                  Календарь событий{" "}
                  <ArrowDownRight size={18} aria-hidden="true" />
                </a>
                <a href={sectionLink("commission/news")}>
                  Новости <ArrowDownRight size={18} aria-hidden="true" />
                </a>
                <a href={sectionLink("commission/contacts")}>
                  Контакты комиссии{" "}
                  <ArrowDownRight size={18} aria-hidden="true" />
                </a>
              </aside>
            </div>
            <Updates id="news" title="Новости" entries={news} />
            <Contacts />
            <Updates id="events" title="События" entries={events} />
          </>
        )}
      </main>

      <footer className="shell footer">
        <div>
          <strong>Абитуриенту БГТУ</strong>
          <p>Приёмная комиссия · Брянск</p>
        </div>
        <a href={sectionLink("commission/contacts")}>Контакты</a>
        <a href={official}>
          Официальный сайт БГТУ <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo(0, 0);
          }}
        >
          Наверх{" "}
          <ArrowDown className="to-top-icon" size={16} aria-hidden="true" />
        </a>
      </footer>
      <Assistant open={chat} setOpen={setChat} />
    </div>
  );
}

createRoot(document.getElementById("applicant-root")!).render(<App />);
