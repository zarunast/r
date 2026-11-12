export type Page =
  | "dashboard"
  | "registry"
  | "rankings"
  | "contracts"
  | "calls"
  | "reports"
  | "activity";
export type Quota = "general" | "special" | "separate" | "target" | "paid";
export type User = { login: string; display_name: string; role: string };
export type Group = { direction: string; campaign: string; study_form: string };
export type DashboardData = {
  date: string;
  year: number;
  applicants: number;
  applications: number;
  applications_today: number;
  paid_contracts: number;
  overcrowded: number;
  plan_count: number;
  enrolled: number;
};
export type Activity = {
  id: number;
  at: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
  status: string;
  role?: string;
};
export type Result<T> = { items: T[]; total: number };
export type Person = {
  number: string;
  surname: string;
  first_name: string;
  patronymic: string;
  phone: string;
  email: string;
  applications_count: number;
  best_score: number;
};
export type Application = Group & {
  id: number;
  applicant_number: string;
  year: number;
  quota: Quota;
  priority: number;
  status: string;
  total_score: number;
  achievements: number;
  exams: Record<string, number>;
  consent: boolean;
};
export type PersonDetail = Omit<
  Person,
  "phone" | "email" | "applications_count" | "best_score"
> & {
  profile: Record<string, unknown>;
  applications: Application[];
  contracts: Contract[];
};
export type Rank = {
  applicant_number: string;
  application_id: number;
  full_name: string;
  score: number;
  rank: number;
  consent: boolean;
  priority: number;
  status: string;
  quota: Quota;
  direction: string;
};
export type RankingsData = {
  lists: Record<Quota, Rank[]>;
  seats: Partial<Record<Quota, number>>;
};
export type Contract = {
  id: number;
  number: string;
  application_id: number;
  applicant_number: string;
  full_name: string;
  direction: string;
  study_form: string;
  location: string;
  stage: string;
  paid: boolean;
  created_at: string;
};
export type CallItem = {
  application_id: number;
  applicant_number: string;
  phone: string;
  direction: string;
  priority_score: number;
  method: string;
  reasons: string[];
  last_result: string | null;
};
export type Statistics = {
  year: number;
  applicants: number;
  applications: number;
  statuses: Record<string, number>;
  groups: (Group & {
    quota: Quota;
    applications: number;
    active: number;
    seats: number | null;
    overcrowded: boolean | null;
  })[];
};
export type ImportReport = {
  rows: number;
  new_applicants: number;
  updated_applicants: number;
  new_applications: number;
  updated_applications: number;
  errors: { row: number; error: string }[];
  warnings: string[];
};

export const quotaLabels: Record<Quota, string> = {
  general: "Основной конкурс",
  special: "Особая квота",
  separate: "Отдельная квота",
  target: "Целевая квота",
  paid: "Платное обучение",
};
export const stageLabels: Record<string, string> = {
  draft: "Черновик",
  issued: "Выдан",
  signed: "Подписан",
  registered: "Зарегистрирован",
  cancelled: "Отменён",
};
export const locationLabels: Record<string, string> = {
  admissions: "Приёмная комиссия",
  applicant: "У абитуриента",
  accounting: "Бухгалтерия",
  archive: "Архив",
};
export const statusLabels: Record<string, string> = {
  participating: "В конкурсе",
  pending: "На рассмотрении",
  accepted: "Принято",
  enrolled: "Зачислен",
  withdrawn: "Отозвано",
  rejected: "Отклонено",
};
export const callLabels: Record<string, string> = {
  no_answer: "Не ответил",
  interested: "Заинтересован",
  callback: "Перезвонить",
  declined: "Отказ",
  confirmed: "Подтвердил",
};
export const numberFormat = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n);
export const fullName = (p: {
  surname: string;
  first_name: string;
  patronymic?: string;
}) => [p.surname, p.first_name, p.patronymic].filter(Boolean).join(" ");
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export const params = (values: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
