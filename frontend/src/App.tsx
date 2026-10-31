import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileBarChart2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Phone,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLoad, useStore } from "./store";
import {
  initials,
  params,
  type Activity as ActivityItem,
  type CallItem,
  type Page,
  type Result,
} from "./types";
import { demoDate } from "./demo";
import { Modal, PageHeading } from "./components/ui";
import { ActivityTable } from "./components/ActivityTable";
import { ImportModal } from "./components/ImportModal";
import { Dashboard } from "./pages/Dashboard";
import { Registry } from "./pages/Registry";
import { Rankings } from "./pages/Rankings";
import { Contracts } from "./pages/Contracts";
import { Calls } from "./pages/Calls";
import { Reports } from "./pages/Reports";
import { Login } from "./pages/Login";

const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
  { id: "registry", label: "Реестр", icon: Users },
  { id: "rankings", label: "Рейтинги", icon: ChartColumn },
  { id: "contracts", label: "Договоры", icon: FileText },
  { id: "calls", label: "Звонки", icon: Phone },
  { id: "reports", label: "Отчёты", icon: FileBarChart2 },
];

export default function App() {
  const { demo, user, year, setYear, logout, notices, api, dates } = useStore();
  const [route, setRoute] = useState(
    window.location.hash.replace("#/", "") || "dashboard",
  );
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [importKind, setImportKind] = useState<"epgu" | "payments" | null>(
    null,
  );
  const [online, setOnline] = useState(true);
  const [bell, setBell] = useState(false);
  const [profile, setProfile] = useState(false);
  const events = useLoad<Result<ActivityItem>>("/activities?limit=3");
  const calls = useLoad<CallItem[]>(
    dates.change && dates.payment
      ? `/calls/queue?${params({ year, change_deadline: dates.change, payment_deadline: dates.payment })}`
      : null,
  );
  useEffect(() => {
    const handler = () => {
      setRoute(window.location.hash.replace("#/", "") || "dashboard");
      setMobile(false);
      setBell(false);
      setProfile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    let active = true;
    const check = () => {
      if (demo) {
        setOnline(true);
        return;
      }
      api("/health")
        .then(() => {
          if (active) setOnline(true);
        })
        .catch(() => {
          if (active) setOnline(false);
        });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [demo, api]);
  const now = new Date(
    demo
      ? demoDate + "T12:00:00"
      : new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }),
  );
  const deadline = new Date(`${dates.change || `${year}-08-20`}T23:59:59`);
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - now.getTime()) / 86400000),
  );
  const progress = Math.min(
    100,
    Math.max(
      0,
      ((now.getTime() - new Date(`${year}-06-20`).getTime()) /
        (deadline.getTime() - new Date(`${year}-06-20`).getTime())) *
        100,
    ),
  );
  const page = navigation.find((n) => n.id === route);
  const titles: Record<string, string> = {
    dashboard: "АИС Приёмная комиссия",
    registry: "Реестр абитуриентов",
    rankings: "Конкурсные рейтинги",
    contracts: "Работа с договорами",
    calls: "Работа с абитуриентами",
    reports: "Отчётность и аналитика",
    activity: "Журнал активности",
  };
  const importEpgu = () => setImportKind("epgu");
  const content =
    route === "dashboard" ? (
      <Dashboard onImport={importEpgu} callCount={calls.data?.length} />
    ) : route === "registry" ? (
      <Registry onImport={importEpgu} />
    ) : route === "rankings" ? (
      <Rankings />
    ) : route === "contracts" ? (
      <Contracts onPayments={() => setImportKind("payments")} />
    ) : route === "calls" ? (
      <Calls />
    ) : route === "reports" ? (
      <Reports />
    ) : route === "activity" ? (
      <>
        <PageHeading
          title="Активность сотрудников"
          subtitle="История операций и системных событий приёмной комиссии"
        />
        <ActivityTable full />
      </>
    ) : (
      <div className="not-found">
        <h1>Страница не найдена</h1>
        <p>Выберите раздел в боковом меню.</p>
        <a href="#/dashboard" className="button primary">
          На дашборд
        </a>
      </div>
    );
  return (
    <>
      {route === "login" ? (
        <Login />
      ) : (
        <div className="app-shell">
          {mobile && (
            <button
              className="sidebar-backdrop"
              aria-label="Закрыть меню"
              onClick={() => setMobile(false)}
            />
          )}
          <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
            <a className="brand" href="#/dashboard">
              <span className="brand-mark">Б</span>
              <span>
                <strong>АИС ПК</strong>
                <small>БГТУ {year}</small>
              </span>
            </a>
            <div className="nav-section-label">Рабочее пространство</div>
            <nav aria-label="Основная навигация">
              {navigation.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#/${id}`}
                  className={`nav-item ${route === id ? "active" : ""}`}
                  aria-current={route === id ? "page" : undefined}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{label}</span>
                  {id === "calls" && !!calls.data?.length && (
                    <span className="nav-count">{calls.data.length}</span>
                  )}
                </a>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <a href="#/calls" className="campaign-card">
                <div>
                  <CalendarDays size={17} />
                  <strong>Приём заявлений</strong>
                </div>
                <span>
                  {!dates.change
                    ? "Сроки пока не заданы"
                    : daysLeft
                      ? `До завершения ${daysLeft} дн.`
                      : "Приём заявлений завершён"}
                </span>
                {demo && (
                  <div className="campaign-progress">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                )}
                <small>
                  {dates.change
                    ? `Завершение: ${deadline.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
                    : "Указать сроки в разделе «Звонки»"}
                </small>
              </a>
              {demo && (
                <a className="demo-connect" href="#/login">
                  <span>
                    <FlaskConical size={14} />
                    Демонстрационный режим
                  </span>
                  <strong>
                    Подключить рабочую базу
                    <ArrowRight size={13} />
                  </strong>
                </a>
              )}
              <button className="help-button" onClick={() => setHelp(true)}>
                <CircleHelp size={17} />
                Помощь и поддержка
              </button>
            </div>
            <div className="sidebar-version">
              <span className="tiny-dot" />
              АИС ПК <span>v0.2</span>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobile(!mobile)}
                aria-label="Открыть меню"
              >
                <Menu size={22} />
              </button>
              <div className="topbar-title">
                <strong>{titles[route] || "АИС Приёмная комиссия"}</strong>
                <label>
                  Приёмная кампания
                  <select
                    aria-label="Год приёмной кампании"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {Array.from({ length: 7 }, (_, i) => 2023 + i).map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} />
                </label>
              </div>
              <div className="topbar-right">
                {demo && (
                  <a className="demo-label" href="#/login">
                    <FlaskConical size={12} />
                    Демо-режим
                  </a>
                )}
                <span className={`system-status ${!online ? "offline" : ""}`}>
                  <span />
                  {online ? "Система работает" : "Сервер недоступен"}
                </span>
                <div className="popover-wrap">
                  <button
                    className={`icon-button notification-button ${bell ? "pressed" : ""}`}
                    onClick={() => {
                      setBell(!bell);
                      setProfile(false);
                    }}
                    aria-label="Уведомления"
                    aria-expanded={bell}
                  >
                    <Bell size={21} />
                    <i />
                  </button>
                  {bell && (
                    <>
                      <button
                        className="popover-dismiss"
                        tabIndex={-1}
                        aria-label="Закрыть уведомления"
                        onClick={() => setBell(false)}
                      />
                      <div className="popover notification-popover">
                        <div className="popover-heading">
                          <strong>Последние события</strong>
                          <span>{events.data?.total || 0}</span>
                        </div>
                        {events.data?.items.length ? (
                          events.data.items.map((e) => (
                            <div className="notification-item" key={e.id}>
                              <span className="notification-symbol">
                                <Activity size={15} />
                              </span>
                              <div>
                                <strong>{e.action}</strong>
                                <p>{e.object}</p>
                                <small>
                                  {new Date(e.at).toLocaleString("ru-RU", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Europe/Moscow",
                                  })}
                                </small>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="popover-empty">
                            Новых событий пока нет
                          </p>
                        )}
                        <a href="#/activity" className="popover-link">
                          Открыть журнал
                          <ArrowRight size={14} />
                        </a>
                      </div>
                    </>
                  )}
                </div>
                <span className="header-separator" />
                <div className="popover-wrap">
                  <button
                    className="profile-button"
                    onClick={() => {
                      setProfile(!profile);
                      setBell(false);
                    }}
                    aria-expanded={profile}
                  >
                    <span className="avatar avatar-0">
                      {initials(user.display_name)}
                    </span>
                    <span>
                      <strong>{user.display_name}</strong>
                      <small>{user.role}</small>
                    </span>
                    <ChevronDown size={13} />
                  </button>
                  {profile && (
                    <>
                      <button
                        className="popover-dismiss"
                        tabIndex={-1}
                        aria-label="Закрыть меню профиля"
                        onClick={() => setProfile(false)}
                      />
                      <div className="popover profile-popover">
                        <strong>{user.display_name}</strong>
                        <p>
                          {demo ? "Демонстрационные данные" : "Сотрудник БГТУ"}
                        </p>
                        {demo ? (
                          <a href="#/login">
                            <LogIn size={16} />
                            Войти в рабочую базу
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              logout();
                              setProfile(false);
                              window.location.hash = "/login";
                            }}
                          >
                            <LogOut size={16} />
                            Выйти из системы
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>
            <main
              className={`main-content page-${page?.id || route}`}
              key={`${route}-${year}`}
            >
              {content}
            </main>
            <footer className="app-footer">
              <span>© {year} БГТУ. АИС Приёмная комиссия</span>
              <button onClick={() => setHelp(true)}>
                Нужна помощь?
                <CircleHelp size={13} />
              </button>
            </footer>
          </div>
        </div>
      )}
      <div className="toast-container" aria-live="polite">
        {notices.map((n) => (
          <div className={`toast toast-${n.kind}`} key={n.id}>
            {n.kind === "success" ? (
              <CheckCircle2 size={19} />
            ) : (
              <CircleHelp size={19} />
            )}
            <span>{n.message}</span>
          </div>
        ))}
      </div>
      {importKind && (
        <ImportModal kind={importKind} onClose={() => setImportKind(null)} />
      )}
      {help && (
        <Modal
          title="Помощь и поддержка"
          subtitle="АИС Приёмная комиссия БГТУ"
          onClose={() => setHelp(false)}
        >
          <div className="help-intro">
            <ShieldCheck size={30} />
            <p>
              Ваше рабочее пространство для сопровождения приёмной кампании.
            </p>
          </div>
          <div className="help-items">
            <div>
              <strong>Как загрузить заявления?</strong>
              <p>
                Нажмите «Загрузить Excel» на дашборде. Выберите выгрузку ЕПГУ в
                формате XLSX. Для загрузки войдите в рабочую базу.
              </p>
            </div>
            <div>
              <strong>Где посмотреть место абитуриента?</strong>
              <p>
                Откройте «Рейтинги», выберите конкурсную группу и нужную
                категорию. Карточка абитуриента открывается нажатием на имя.
              </p>
            </div>
            <div>
              <strong>Как подтвердить оплату?</strong>
              <p>
                В разделе «Договоры» нажмите «Загрузить оплаты» и выберите Excel
                из бухгалтерии со столбцами «Номер договора» и «Оплачен».
              </p>
            </div>
            <div>
              <strong>Не получается войти?</strong>
              <p>
                Убедитесь, что подключены к сети БГТУ. Для получения или
                восстановления доступа обратитесь к администратору университета.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setHelp(false)}>
              Всё понятно
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
