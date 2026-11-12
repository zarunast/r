import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleCheck,
  FileText,
  Phone,
  ShieldCheck,
  TriangleAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLoad, useStore } from "../store";
import { numberFormat, type DashboardData } from "../types";
import { ActivityTable } from "../components/ActivityTable";
import { ErrorState } from "../components/ui";

export function Dashboard({
  onImport,
  callCount,
}: {
  onImport: () => void;
  callCount?: number;
}) {
  const { year, user, demo } = useStore();
  const { data, loading, error } = useLoad<DashboardData>(
    `/dashboard?year=${year}`,
  );
  const firstName = user.display_name.split(" ")[0];
  const activeDemo = demo && year === 2026;
  const metrics = [
    {
      title: "Всего абитуриентов",
      value: data?.applicants,
      icon: Users,
      color: "blue",
      trend: activeDemo ? "+12% за неделю" : `Приёмная кампания ${year}`,
      link: "#/registry",
    },
    {
      title: "Заявлений сегодня",
      value: data?.applications_today,
      icon: FileText,
      color: "blue",
      trend: activeDemo
        ? "+8% к предыдущему дню"
        : `Всего ${numberFormat(data?.applications || 0)} заявлений`,
      link: "#/registry",
    },
    {
      title: "Оплачено договоров",
      value: data?.paid_contracts,
      icon: CircleCheck,
      color: "green",
      trend: activeDemo ? "+15% к прошлой неделе" : "Подтверждено бухгалтерией",
      link: "#/contracts",
    },
    {
      title: "Переполненных программ",
      value: data?.overcrowded,
      icon: TriangleAlert,
      color: "red",
      trend: data?.overcrowded
        ? "Требует внимания"
        : data?.plan_count
          ? "В пределах плана приёма"
          : "План мест пока не задан",
      link: "#/reports",
    },
  ];
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <h1>
            Добро пожаловать, {firstName}
            <span className="welcome-dot">.</span>
          </h1>
          <p>
            {activeDemo ? (
              <>
                Сегодня <span className="text-dark">1 284</span> новых заявления
                — на 8,6% больше, чем вчера
              </>
            ) : (
              <>
                Сегодня {numberFormat(data?.applications_today || 0)} новых
                заявлений. Все процессы приёма — в одном месте.
              </>
            )}
          </p>
        </div>
        <div className="date-label">
          <CalendarDays size={17} />
          {data
            ? new Date(data.date + "T12:00:00")
                .toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
                .replace(" г.", "")
            : "Загрузка даты…"}
        </div>
      </div>
      {error && <ErrorState error={error} />}
      <div className="metrics-grid">
        {metrics.map(({ title, value, icon: Icon, color, trend, link }) => (
          <a className="metric-card" href={link} key={title}>
            <div className="metric-top">
              <span>{title}</span>
              <span className={`metric-icon icon-${color}`}>
                <Icon size={20} strokeWidth={1.9} />
              </span>
            </div>
            <strong className={loading && !data ? "skeleton-number" : ""}>
              {value === undefined ? "—" : numberFormat(value)}
            </strong>
            <div
              className={`metric-trend ${color === "red" ? (value ? "danger" : "muted") : activeDemo ? "positive" : "muted"}`}
            >
              {color === "red" ? (
                <span className={`tiny-dot ${value ? "red-dot" : ""}`} />
              ) : activeDemo ? (
                <TrendingUp size={13} />
              ) : (
                <span className="tiny-dot" />
              )}
              {trend}
            </div>
          </a>
        ))}
      </div>
      <section className="quick-actions">
        <div className="section-heading">
          <h2>Быстрые действия</h2>
          <span>Часто используемые операции</span>
        </div>
        <div className="actions-grid">
          <button className="action-card action-primary" onClick={onImport}>
            <span className="action-icon">
              <ArrowDownToLine size={23} />
            </span>
            <span>
              <strong>Загрузить Excel</strong>
              <small>Импорт заявлений и результатов</small>
            </span>
            <ArrowRight className="action-arrow" size={21} />
          </button>
          <a className="action-card" href="#/rankings">
            <span className="action-icon">
              <BarChart3 size={23} />
            </span>
            <span>
              <strong>Сформировать рейтинги</strong>
              <small>Обновить конкурсные списки</small>
            </span>
            <ArrowRight className="action-arrow" size={20} />
          </a>
          <a className="action-card" href="#/calls">
            <span className="action-icon">
              <Phone size={22} />
            </span>
            <span>
              <strong>Список для обзвона</strong>
              <small>
                {callCount !== undefined
                  ? `Ожидают звонка: ${callCount}`
                  : "Звонки и результаты общения"}
              </small>
            </span>
            <ArrowRight className="action-arrow" size={20} />
          </a>
        </div>
      </section>
      <ActivityTable />
      <div className="dashboard-bottom">
        <div className="secure-note">
          <ShieldCheck size={17} />
          <span>
            Внутренний контур БГТУ<span className="note-divider">·</span>Доступ
            только для сотрудников
          </span>
        </div>
        <span className="muted">
          {demo ? "Демонстрационные данные" : "Данные вашей приёмной комиссии"}
        </span>
      </div>
    </>
  );
}
