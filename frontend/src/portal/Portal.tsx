import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Code2,
  Cpu,
  ExternalLink,
  Eye,
  FileCheck2,
  FlaskConical,
  GraduationCap,
  Landmark,
  Lightbulb,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  Target,
  Wrench,
  X,
} from "lucide-react";
import { numberFormat, quotaLabels } from "../types";
import { usePortal, usePublicLoad } from "./state";
import {
  groupKey,
  primaryQuota,
  fundingLabel,
  government,
  levelName,
  official,
  type Catalog,
  type PublicGroup,
  type Quota,
} from "./types";
import { ApplicantSearch } from "./Search";
import { PublicRatings } from "./Ratings";
import { Assistant } from "./Assistant";
import { PortalNotice, PortalBusy } from "./ui";

function UniversityMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`p-university-mark ${inverse ? "inverse" : ""}`}
      aria-hidden="true"
    >
      <span>Б</span>
      <span className="p-mark-line" />
      <small>БГТУ</small>
    </span>
  );
}

export default function Portal() {
  const { demo, setDemo, year, setYear } = usePortal();
  const [menu, setMenu] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [active, setActive] = useState(window.location.hash.slice(1) || "home");
  const [chat, setChat] = useState(false);
  useEffect(() => {
    const change = () => {
      setActive(window.location.hash.slice(1) || "home");
      setMenu(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const links = [
    ["home", "Абитуриенту"],
    ["programs", "Направления подготовки"],
    ["ratings", "Конкурсные списки"],
    ["steps", "Как поступить"],
    ["faq", "Вопросы и ответы"],
  ];
  return (
    <div
      className={`admissions-portal ${contrast ? "p-accessible" : ""}`}
      id="home"
    >
      <a className="p-skip" href="#search">
        Перейти к поиску абитуриента
      </a>
      <div className="p-utility">
        <div className="p-container">
          <span>Государственный университет · Брянск</span>
          <div>
            <a
              href="https://www.tu-bryansk.ru/"
              target="_blank"
              rel="noreferrer"
            >
              Официальный сайт
              <ArrowUpRight size={11} />
            </a>
            <span className="p-utility-divider" />
            <button
              aria-pressed={contrast}
              onClick={() => setContrast(!contrast)}
            >
              <Eye size={14} />
              {contrast ? "Обычная версия" : "Версия для слабовидящих"}
            </button>
          </div>
        </div>
      </div>
      <header className="p-header">
        <div className="p-container">
          <a
            href="#home"
            className="p-brand"
            aria-label="БГТУ — портал абитуриента"
          >
            <UniversityMark />
            <span>
              <strong>
                Брянский государственный
                <br />
                технический университет
              </strong>
              <small>ПОРТАЛ АБИТУРИЕНТА</small>
            </span>
          </a>
          <div className="p-header-info">
            <span className="p-header-year">
              <span className="p-blue-dot" />
              Приёмная кампания
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label="Год приёма"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <ChevronDown size={11} />
            </span>
            <a
              href={official}
              className="p-contacts-link"
              target="_blank"
              rel="noreferrer"
            >
              Приёмная комиссия
              <ArrowUpRight size={15} />
            </a>
          </div>
          <a href="#search" className="p-button p-button-blue p-header-cta">
            <Search size={16} />
            Мой конкурс
          </a>
          <button
            className="p-mobile-toggle"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menu}
          >
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      <nav
        className={`p-nav ${menu ? "p-nav-open" : ""}`}
        aria-label="Навигация абитуриента"
      >
        <div className="p-container">
          {links.map(([id, label]) => (
            <a
              className={active === id ? "active" : ""}
              href={`#${id}`}
              key={id}
              onClick={() => setMenu(false)}
            >
              {label}
              {id === "programs" && <ChevronDown size={12} />}
            </a>
          ))}
          <a
            href="#contacts"
            className={
              active === "contacts" ? "active p-nav-contact" : "p-nav-contact"
            }
          >
            Контакты
            <ArrowUpRight size={13} />
          </a>
        </div>
      </nav>
      {demo && (
        <div className="p-demo-bar">
          <div className="p-container">
            <span>
              <FlaskConical size={15} />
              Демонстрация: все номера, баллы и планы мест вымышлены.
            </span>
            <button onClick={() => setDemo(false)}>
              Перейти к реальным данным
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      <PortalContent key={`${demo}-${year}`} />
      <footer className="p-footer" id="contacts">
        <div className="p-container p-footer-main">
          <div>
            <a href="#home" className="p-brand">
              <UniversityMark inverse />
              <span>
                <strong>
                  Брянский государственный
                  <br />
                  технический университет
                </strong>
                <small>ТВОЁ БУДУЩЕЕ НАЧИНАЕТСЯ ЗДЕСЬ</small>
              </span>
            </a>
            <p>
              Портал абитуриента БГТУ.
              <br />
              Помогаем сделать первый шаг в профессию.
            </p>
          </div>
          <div>
            <h3>Поступающим</h3>
            <a href="#programs">Направления подготовки</a>
            <a href="#ratings">Конкурсные списки</a>
            <a href="#search">Поиск по номеру ЕПГУ</a>
            <a href="#steps">Как подать документы</a>
          </div>
          <div>
            <h3>Полезные ссылки</h3>
            <a href={government} target="_blank" rel="noreferrer">
              Поступление на Госуслугах
              <ExternalLink size={11} />
            </a>
            <a href={official} target="_blank" rel="noreferrer">
              Официальные правила приёма
              <ExternalLink size={11} />
            </a>
            <a href={official} target="_blank" rel="noreferrer">
              Приёмная комиссия
              <ExternalLink size={11} />
            </a>
            <button onClick={() => setChat(true)}>
              Задать вопрос помощнику
              <MessageCircle size={12} />
            </button>
          </div>
          <div className="p-footer-contact">
            <h3>Остаёмся на связи</h3>
            <p>Брянск, Россия</p>
            <a
              href={official}
              target="_blank"
              rel="noreferrer"
              className="p-footer-contact-link"
            >
              Контакты и часы работы
              <ArrowUpRight size={17} />
            </a>
            <p className="p-footer-small">
              Действующие сроки, стоимость обучения и юридические условия
              уточняйте на официальной странице приёмной комиссии.
            </p>
          </div>
        </div>
        <div className="p-container p-footer-bottom">
          <span>© {year} БГТУ · Портал абитуриента</span>
          <span>
            <ShieldCheck size={13} />
            Персональные данные в открытых списках не публикуются
          </span>
          <a href="/#/login">
            Вход для сотрудников
            <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
      <Assistant
        open={chat}
        setOpen={setChat}
        key={demo ? "demo-assistant" : "live-assistant"}
      />
    </div>
  );
}

function PortalContent() {
  const { year, demo, setDemo, reload } = usePortal();
  const catalog = usePublicLoad<Catalog>(`/public/catalog?year=${year}`);
  const [group, setGroup] = useState<string>("");
  const [quota, setQuota] = useState<Quota>("general");
  const [highlight, setHighlight] = useState("");
  const groups = catalog.data?.groups || [];
  const selected = groups.find((g) => groupKey(g) === group) || groups[0];
  useEffect(() => {
    if (!group && catalog.data?.groups.length) {
      setGroup(groupKey(catalog.data.groups[0]));
      setQuota(primaryQuota(catalog.data.groups[0]));
    }
  }, [group, catalog.data]);
  const openRating = (
    g: PublicGroup,
    category: Quota = "general",
    number?: string,
  ) => {
    setGroup(groupKey(g));
    setQuota(category);
    if (number) setHighlight(number);
    window.location.hash = "ratings";
    document
      .getElementById("ratings")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <main>
      <section className="p-hero">
        <div className="p-container p-hero-inner">
          <div className="p-hero-copy">
            <span className="p-hero-eyebrow">
              <span />
              ТВОЯ НОВАЯ ГЛАВА · БГТУ {year}
            </span>
            <h1>
              Выбирай будущее.
              <br />
              Поступай в <span>БГТУ.</span>
            </h1>
            <p>
              От первого решения — к большим возможностям.
              <br className="p-desktop-break" /> Найди своё направление и следи
              за поступлением
              <br className="p-desktop-break" /> в одном пространстве.
            </p>
            <div className="p-hero-actions">
              <a href="#programs" className="p-button p-button-yellow">
                Выбрать направление
                <ArrowRight size={17} />
              </a>
              <a href="#steps" className="p-hero-secondary">
                Как поступить
                <ArrowDown size={15} />
              </a>
            </div>
            <div className="p-hero-caption">
              <GraduationCap size={16} />
              Инженерное мышление. Реальные перспективы.
            </div>
          </div>
          <HeroArt year={year} />
        </div>
      </section>
      <div className="p-container p-main-container">
        <ApplicantSearch
          groups={groups}
          onRating={openRating}
          onHighlight={setHighlight}
        />
        <div className="p-feature-strip">
          <div>
            <span>
              <ShieldCheck size={20} />
            </span>
            <p>
              <strong>Без регистрации</strong>
              <small>Для поиска нужен только номер ЕПГУ</small>
            </p>
          </div>
          <div>
            <span>
              <ClipboardList size={20} />
            </span>
            <p>
              <strong>Все конкурсы в одном месте</strong>
              <small>Пять категорий для каждого направления</small>
            </p>
          </div>
          <div>
            <span>
              <Target size={20} />
            </span>
            <p>
              <strong>Понимай свои шансы</strong>
              <small>Оценка положения в текущем рейтинге</small>
            </p>
          </div>
        </div>
        <section className="p-section p-programs-section" id="programs">
          <div className="p-section-heading">
            <div>
              <span className="p-eyebrow">ОТ ИНТЕРЕСА — К ПРОФЕССИИ</span>
              <h2>Найди своё направление</h2>
              <p>Выбирай то, что тебе близко. Мы поможем сориентироваться.</p>
            </div>
            <a
              href={official}
              target="_blank"
              rel="noreferrer"
              className="p-text-link"
            >
              Правила приёма
              <ArrowUpRight size={15} />
            </a>
          </div>
          {catalog.error ? (
            <PortalNotice error>
              {catalog.error}
              <button className="p-inline-button" onClick={reload}>
                Повторить загрузку
              </button>
            </PortalNotice>
          ) : catalog.loading ? (
            <PortalBusy />
          ) : (
            <Programs groups={groups} onRating={openRating} />
          )}
          {!demo && !catalog.loading && !catalog.error && !groups.length && (
            <div className="p-empty-catalog">
              <BookOpen size={28} />
              <h3>Каталог кампании {year} пока не опубликован</h3>
              <p>
                Актуальные направления и условия можно уточнить у приёмной
                комиссии.
              </p>
              <a
                href={official}
                target="_blank"
                rel="noreferrer"
                className="p-text-link"
              >
                Официальная информация
                <ArrowUpRight size={15} />
              </a>
              <button
                className="p-demo-example"
                onClick={() => {
                  setDemo(true);
                  window.location.hash = "search";
                }}
              >
                Посмотреть работу портала на примере
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
        <PublicRatings
          groups={groups}
          selected={selected}
          onSelect={(g) => {
            setGroup(groupKey(g));
            setQuota(primaryQuota(g));
          }}
          quota={quota}
          onQuota={setQuota}
          highlight={highlight}
          loadingCatalog={catalog.loading}
        />
        <Steps />
        <FAQ />
      </div>
    </main>
  );
}

function Programs({
  groups,
  onRating,
}: {
  groups: PublicGroup[];
  onRating: (group: PublicGroup, quota?: Quota) => void;
}) {
  const [level, setLevel] = useState("");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(6);
  if (!groups.length) return null;
  const filtered = groups.filter(
    (g) =>
      (!level || g.campaign === level) &&
      `${g.title} ${g.code || ""} ${g.direction}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const iconFor = (g: PublicGroup) =>
    /информ|программ/i.test(g.title)
      ? Code2
      : /электр/i.test(g.title)
        ? Cpu
        : /математ/i.test(g.title)
          ? FlaskConical
          : /эконом/i.test(g.title)
            ? Landmark
            : Wrench;
  return (
    <>
      <div className="p-program-filters">
        <div
          className="p-level-tabs"
          role="group"
          aria-label="Уровень образования"
        >
          {[
            ["", "Все направления"],
            ["бак", "Бакалавриат"],
            ["маг", "Магистратура"],
            ["асп", "Аспирантура"],
          ].map(([k, label]) => (
            <button
              className={level === k ? "active" : ""}
              key={k}
              aria-pressed={level === k}
              onClick={() => {
                setLevel(k);
                setVisible(6);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="p-program-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(6);
            }}
            placeholder="Название или код направления"
            aria-label="Поиск направления"
          />
        </label>
      </div>
      <div className="p-program-grid">
        {filtered.slice(0, visible).map((g) => {
          const Icon = iconFor(g);
          const category = primaryQuota(g);
          return (
            <article className="p-program-card" key={groupKey(g)}>
              <div className="p-program-card-top">
                <span className="p-program-icon">
                  <Icon size={23} />
                </span>
                <span className="p-program-code">
                  {g.code || levelName(g.campaign)}
                </span>
              </div>
              <span className="p-program-level">
                {levelName(g.campaign)} · {g.study_form} · {fundingLabel(g)}
              </span>
              <h3>{g.title}</h3>
              <div className="p-program-facts">
                <div>
                  <span>{quotaLabels[category]}</span>
                  <strong>
                    {g.seats[category] === null
                      ? "План уточняется"
                      : `${numberFormat(g.seats[category]!)} мест`}
                  </strong>
                </div>
                <div>
                  <span>В конкурсе</span>
                  <strong>
                    {numberFormat(
                      Object.values(g.applications).reduce((a, b) => a + b, 0),
                    )}{" "}
                    заявлений
                  </strong>
                </div>
              </div>
              <button onClick={() => onRating(g, category)}>
                Посмотреть конкурс
                <ArrowUpRight size={17} />
              </button>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="p-small-empty">
          <Search size={24} />
          <h3>Направления не найдены</h3>
          <p>Попробуй изменить запрос или уровень образования.</p>
          <button
            className="p-inline-button"
            onClick={() => {
              setQuery("");
              setLevel("");
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}
      {visible < filtered.length && (
        <div className="p-show-more">
          <button
            className="p-button p-button-outline"
            onClick={() => setVisible((v) => v + 6)}
          >
            Показать ещё направления
            <ChevronDown size={16} />
            <span>{filtered.length - visible}</span>
          </button>
        </div>
      )}
    </>
  );
}

function Steps() {
  const steps = [
    {
      icon: BookOpen,
      title: "Выбери направление",
      text: "Сравни программы, формы обучения и категории конкурса.",
      href: "#programs",
      link: "Перейти к направлениям",
    },
    {
      icon: FileCheck2,
      title: "Подай документы",
      text: "Ознакомься с правилами приёма и отправь заявление через Госуслуги.",
      href: government,
      link: "Подать через Госуслуги",
    },
    {
      icon: ClipboardList,
      title: "Следи за конкурсом",
      text: "Найди свой номер ЕПГУ и проверь место по каждому заявлению.",
      href: "#search",
      link: "Найти себя в списках",
    },
    {
      icon: GraduationCap,
      title: "Сделай следующий шаг",
      text: "Уточни порядок согласия на зачисление и оформления договора в комиссии.",
      href: official,
      link: "Уточнить условия приёма",
    },
  ];
  return (
    <section className="p-section p-steps-section" id="steps">
      <div className="p-section-heading">
        <div>
          <span className="p-eyebrow">ПРОСТО О ВАЖНОМ</span>
          <h2>Твой путь в университет</h2>
          <p>Четыре шага к новой главе твоей жизни.</p>
        </div>
        <span className="p-steps-label">
          <Lightbulb size={17} />
          Мы рядом на каждом этапе
        </span>
      </div>
      <div className="p-steps-grid">
        {steps.map(({ icon: Icon, title, text, href, link }, i) => (
          <article key={title}>
            <div className="p-step-top">
              <span>
                <Icon size={22} />
              </span>
              <b>0{i + 1}</b>
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
            <a
              href={href}
              {...(href.startsWith("http")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {link}
              <ArrowUpRight size={14} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const questions = [
    [
      "Где найти свой номер абитуриента?",
      "Номер указан в заявлении в личном кабинете Госуслуг (ЕПГУ). Вводи его полностью, включая нули в начале. Для поиска на этом портале не нужны ФИО, паспорт или СНИЛС.",
    ],
    [
      "Как формируются конкурсные списки?",
      "Конкурсные списки разделены по направлению, форме обучения, уровню образования и категории конкурса. Место определяется итоговыми баллами. При равных баллах отображается одинаковое место; окончательные условия зачисления определяются правилами приёма.",
    ],
    [
      "Что показывает оценка шансов?",
      "Оценка сравнивает текущее место с планом мест в выбранной категории. Она не учитывает будущие заявления и изменения согласий. Это не гарантия поступления и не решение о зачислении. Если план мест не задан, портал честно сообщает, что данных недостаточно.",
    ],
    [
      "Почему в списках нет фамилий?",
      "Открытый портал показывает только номер абитуриента, баллы и сведения о конкурсе. ФИО, паспортные данные, СНИЛС и контакты остаются во внутренней системе приёмной комиссии.",
    ],
    [
      "Где посмотреть сроки и стоимость обучения?",
      "Сроки и стоимость зависят от приёмной кампании, уровня образования и формы обучения. Проверяй действующие документы на официальной странице приёмной комиссии БГТУ. Ссылка доступна вверху и внизу этой страницы.",
    ],
  ];
  return (
    <section className="p-section p-faq-section" id="faq">
      <div className="p-faq-intro">
        <span className="p-eyebrow">РАЗБЕРЁМСЯ ВМЕСТЕ</span>
        <h2>
          Остались
          <br />
          вопросы?
        </h2>
        <p>
          Собрали самое важное о поступлении и работе с конкурсными списками.
        </p>
        <a
          href={official}
          target="_blank"
          rel="noreferrer"
          className="p-text-link"
        >
          Связаться с комиссией
          <ArrowUpRight size={16} />
        </a>
        <div className="p-faq-note">
          <ShieldCheck size={20} />
          <span>Официальные условия приёма всегда имеют приоритет.</span>
        </div>
      </div>
      <div className="p-faq-list">
        {questions.map(([question, answer], i) => (
          <details key={question} open={i === 0 ? true : undefined}>
            <summary>
              {question}
              <ChevronDown size={18} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function HeroArt({ year }: { year: number }) {
  return (
    <div className="p-hero-art" aria-hidden="true">
      <div className="p-art-grid" />
      <span className="p-art-label p-art-label-top">
        ЗНАНИЯ → ПРАКТИКА → БУДУЩЕЕ
      </span>
      <svg viewBox="0 0 480 360" className="p-engineering-art">
        <defs>
          <linearGradient id="cube-top" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#c2dcff" />
            <stop offset="1" stopColor="#73a7ed" />
          </linearGradient>
          <linearGradient id="cube-right" x1="0" x2="1">
            <stop stopColor="#1a61ad" />
            <stop offset="1" stopColor="#70a7ed" />
          </linearGradient>
          <linearGradient id="ring" x1="0" x2="1">
            <stop stopColor="#9dcaff" stopOpacity=".75" />
            <stop offset="1" stopColor="#c7e3ff" stopOpacity=".12" />
          </linearGradient>
        </defs>
        <ellipse
          cx="241"
          cy="210"
          rx="177"
          ry="84"
          fill="none"
          stroke="url(#ring)"
          strokeWidth="1.1"
          transform="rotate(-28 241 210)"
        />
        <ellipse
          cx="241"
          cy="210"
          rx="198"
          ry="103"
          fill="none"
          stroke="#96c7ff"
          strokeOpacity=".17"
          strokeDasharray="3 7"
          transform="rotate(-28 241 210)"
        />
        <path
          d="M240 74L353 139V268L240 333L127 268V139Z"
          fill="none"
          stroke="#91bcf3"
          strokeOpacity=".2"
        />
        <path
          d="M240 94L333 148V255L240 309L147 255V148Z"
          fill="none"
          stroke="#a8cefa"
          strokeOpacity=".2"
          strokeDasharray="4 5"
        />
        <path d="M240 134L310 174L240 215L170 174Z" fill="url(#cube-top)" />
        <path d="M170 174L240 215V296L170 255Z" fill="#3d7dc6" />
        <path d="M310 174L240 215V296L310 255Z" fill="url(#cube-right)" />
        <path
          d="M240 215V296M170 174L240 215L310 174"
          fill="none"
          stroke="#d3e8ff"
          strokeWidth="1.1"
          strokeOpacity=".7"
        />
        <path
          d="M204 155L240 175L276 155M240 175V197"
          fill="none"
          stroke="#ecf5ff"
          strokeWidth="1.5"
        />
        <path d="M164 89L199 69L234 89L199 109Z" fill="#a8cffc" opacity=".9" />
        <path d="M164 89L199 109V148L164 128Z" fill="#4f8bd3" />
        <path d="M234 89L199 109V148L234 128Z" fill="#7db0eb" />
        <path d="M338 234L364 219L390 234L364 249Z" fill="#ffdc6b" />
        <path d="M338 234L364 249V279L338 264Z" fill="#d6a330" />
        <path d="M390 234L364 249V279L390 264Z" fill="#eaba48" />
        <circle cx="102" cy="237" r="5" fill="#ffdc6b" />
        <circle cx="358" cy="111" r="4" fill="#c4dfff" />
        <path
          d="M354 111H379V93M105 237H78V215"
          stroke="#c0ddff"
          strokeOpacity=".5"
          fill="none"
        />
        <path
          d="M289 64V80M281 72H297M107 153V163M102 158H112"
          stroke="#a3cafa"
          strokeWidth="1.5"
        />
        <text
          x="263"
          y="247"
          fill="#d6e8ff"
          fontSize="16"
          fontFamily="Inter,sans-serif"
          transform="skewY(-30)"
        >
          БГТУ
        </text>
      </svg>
      <div className="p-art-year">
        <span>ПРИЁМНАЯ КАМПАНИЯ</span>
        <strong>{year}</strong>
        <span className="p-art-year-line" />
      </div>
      <span className="p-art-label p-art-label-bottom">
        <span />
        ТЕХНОЛОГИИ НАЧИНАЮТСЯ С ТЕБЯ
      </span>
    </div>
  );
}
