import type {
  Activity,
  Application,
  Contract,
  Group,
  Person,
  PersonDetail,
  Quota,
  Rank,
} from "./types";
import { fullName } from "./types";

export const demoUser = {
  login: "demo",
  display_name: "Анна Кузнецова",
  role: "Ответственный секретарь",
};
export const demoDate = "2026-08-14";
const names = [
  ["Александров", "Михаил", "Сергеевич"],
  ["Андреева", "Анастасия", "Дмитриевна"],
  ["Белов", "Артём", "Андреевич"],
  ["Васильева", "Дарья", "Алексеевна"],
  ["Волков", "Александр", "Игоревич"],
  ["Громова", "Софья", "Михайловна"],
  ["Дмитриев", "Илья", "Олегович"],
  ["Егорова", "Мария", "Андреевна"],
  ["Зайцев", "Даниил", "Сергеевич"],
  ["Иванова", "Полина", "Максимовна"],
  ["Козлов", "Никита", "Денисович"],
  ["Крылова", "Елизавета", "Ивановна"],
  ["Лебедев", "Матвей", "Алексеевич"],
  ["Макарова", "Арина", "Олеговна"],
  ["Морозов", "Тимофей", "Викторович"],
  ["Никитина", "Виктория", "Артёмовна"],
  ["Орлов", "Максим", "Иванович"],
  ["Павлова", "Ксения", "Романовна"],
  ["Петров", "Кирилл", "Сергеевич"],
  ["Романова", "Алиса", "Евгеньевна"],
  ["Смирнов", "Алексей", "Дмитриевич"],
  ["Соколова", "Варвара", "Игоревна"],
  ["Фёдоров", "Егор", "Александрович"],
  ["Яковлева", "Вероника", "Павловна"],
];
export const demoGroups: Group[] = [
  "Программная инженерия",
  "Информатика и вычислительная техника",
  "Прикладная математика и информатика",
  "Экономика",
  "Машиностроение",
].map((direction) => ({ direction, campaign: "бак", study_form: "Очная" }));
let people: Person[] = names.map(([surname, first_name, patronymic], i) => ({
  number: String(10470 + i).padStart(9, "0"),
  surname,
  first_name,
  patronymic,
  phone: "",
  email: `applicant${i + 1}@example.com`,
  applications_count: (i % 3) + 1,
  best_score: 294 - i * 3,
}));
let applications: Application[] = people.flatMap((p, i) =>
  Array.from({ length: p.applications_count }, (_, j) => ({
    id: i * 3 + j + 1,
    applicant_number: p.number,
    year: 2026,
    ...demoGroups[(i + j) % demoGroups.length],
    quota: (i % 4 === 0 ? "paid" : "general") as Quota,
    priority: j + 1,
    status: i % 7 === 0 ? "pending" : "participating",
    total_score: p.best_score - j * 2,
    achievements: i % 10,
    exams: { "Русский язык": 88, Математика: 90, Информатика: 85 },
    consent: i % 3 !== 0,
  })),
);
let contracts: Contract[] = applications
  .filter((a) => a.quota === "paid")
  .map((a, i) => ({
    id: i + 1,
    number: `Д-2026-${1847 + i}`,
    application_id: a.id,
    applicant_number: a.applicant_number,
    full_name: fullName(people.find((p) => p.number === a.applicant_number)!),
    direction: a.direction,
    study_form: a.study_form,
    location: ["accounting", "applicant", "admissions"][i % 3],
    stage: ["registered", "issued", "draft"][i % 3],
    paid: i % 3 === 0,
    created_at: `2026-08-${String(14 - i).padStart(2, "0")}T08:00:00Z`,
  }));
let activities: Activity[] = [
  {
    id: 6,
    at: "2026-08-14T06:42:00Z",
    actor: "Елена Морозова",
    role: "Оператор реестра",
    action: "Импортировала 128 заявлений",
    status: "success",
    object: "Реестр абитуриентов",
    detail: "Excel · пакет #41",
  },
  {
    id: 5,
    at: "2026-08-14T06:18:00Z",
    actor: "Игорь Семёнов",
    role: "Секретарь комиссии",
    action: "Сформировал конкурсный рейтинг",
    status: "info",
    object: "Программная инженерия",
    detail: "Бюджет · бакалавриат",
  },
  {
    id: 4,
    at: "2026-08-14T05:56:00Z",
    actor: "Анна Кузнецова",
    role: "Ответственный секретарь",
    action: "Подтвердила оплату договора",
    status: "paid",
    object: "Договор № Д-1847",
    detail: "Смирнов Алексей",
  },
  {
    id: 3,
    at: "2026-08-14T05:31:00Z",
    actor: "Мария Волкова",
    role: "Оператор реестра",
    action: "Изменила приоритет заявления",
    status: "warning",
    object: "Заявление № 10492",
    detail: "Васильева Дарья",
  },
  {
    id: 2,
    at: "2026-08-14T05:12:00Z",
    actor: "Система ЕПГУ",
    role: "Автоматическая загрузка",
    action: "Обновлены результаты экзаменов",
    status: "info",
    object: "86 абитуриентов",
    detail: "Синхронизация данных",
  },
  {
    id: 1,
    at: "2026-08-14T05:03:00Z",
    actor: "Елена Морозова",
    role: "Оператор реестра",
    action: "Добавила нового абитуриента",
    status: "success",
    object: "Реестр абитуриентов",
    detail: "Карточка абитуриента",
  },
];
const results = new Map<number, string>();
const history = new Map<
  number,
  { at: string; actor: string; changes: Record<string, unknown> }[]
>();
const seats: Record<string, number> = {};
let added = 0;

function activity(action: string, object: string) {
  activities = [
    {
      id: Date.now(),
      at: new Date().toISOString(),
      actor: demoUser.display_name,
      role: demoUser.role,
      action,
      object,
      detail: "Демонстрационные данные",
      status: "success",
    },
    ...activities,
  ];
}

export async function demoRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 140));
  const u = new URL(url, "http://demo.local");
  const q = u.searchParams;
  const path = u.pathname;
  const method = options.method || "GET";
  const body = typeof options.body === "string" ? JSON.parse(options.body) : {};
  const year = Number(q.get("year") || 2026);
  const inYear = applications.filter((a) => a.year === year);
  const page = <V>(items: V[]) => ({
    items: items.slice(
      Number(q.get("offset") || 0),
      Number(q.get("offset") || 0) + Number(q.get("limit") || 20),
    ),
    total: items.length,
  });
  const includes = (text: string) =>
    text
      .toLocaleLowerCase("ru")
      .includes((q.get("q") || "").toLocaleLowerCase("ru"));
  let output: unknown;
  if (path === "/dashboard")
    output = {
      date: demoDate,
      year,
      applicants: year === 2026 ? 10247 + added : 0,
      applications: year === 2026 ? 28614 + added : 0,
      applications_today: year === 2026 ? 1284 + added : 0,
      paid_contracts: year === 2026 ? 847 : 0,
      overcrowded: year === 2026 ? 12 : 0,
      enrolled: year === 2026 ? 2156 : 0,
      plan_count: year === 2026 ? 42 : 0,
    };
  else if (path === "/activities") output = page(activities);
  else if (path === "/catalog/groups") output = year === 2026 ? demoGroups : [];
  else if (path === "/registry") {
    const filtered = people.filter(
      (p) =>
        includes(`${fullName(p)} ${p.number}`) &&
        inYear.some(
          (a) =>
            a.applicant_number === p.number &&
            (!q.get("direction") || a.direction === q.get("direction")) &&
            (!q.get("quota") || a.quota === q.get("quota")) &&
            (!q.get("status") || a.status === q.get("status")),
        ),
    );
    output = page(filtered);
  } else if (path === "/registry" && method === "POST") {
    if (people.some((p) => p.number === body.applicant.number))
      throw new Error("Абитуриент с таким номером уже существует");
    const p = body.applicant;
    const a = body.application;
    const score =
      Object.values(a.exam_scores as Record<string, number>).reduce(
        (sum, v) => sum + v,
        0,
      ) + a.achievements;
    people.unshift({
      ...p,
      phone: p.profile["Телефон"],
      email: p.profile["Почта"],
      applications_count: 1,
      best_score: score,
    });
    applications.push({
      ...a,
      id: Date.now(),
      total_score: score,
      exams: a.exam_scores,
      status: "participating",
    });
    added++;
    activity("Добавлен абитуриент и заявление", "Реестр абитуриентов");
    output = { applicant_number: p.number };
  } else if (path === "/applicants" && method === "POST") {
    if (people.some((p) => p.number === body.number))
      throw new Error("Абитуриент с таким номером уже существует");
    people = [
      {
        ...body,
        phone: body.profile?.["Телефон"] || "",
        email: body.profile?.["Почта"] || "",
        applications_count: 0,
        best_score: 0,
      },
      ...people,
    ];
    added++;
    activity("Добавлен абитуриент", "Реестр абитуриентов");
    output = body;
  } else if (/^\/applicants\/[^/]+$/.test(path)) {
    const number = decodeURIComponent(path.split("/")[2]);
    const found = people.find((p) => p.number === number);
    if (!found) throw new Error("Абитуриент не найден");
    let person: Person = found;
    if (method === "PATCH") {
      person = {
        ...person,
        ...body,
        phone: body.profile?.["Телефон"] ?? person.phone,
        email: body.profile?.["Почта"] ?? person.email,
      };
      people = people.map((p) => (p.number === number ? person! : p));
      activity("Обновлена карточка абитуриента", "Реестр абитуриентов");
    }
    output = {
      ...person,
      profile: {
        Телефон: person.phone,
        Почта: person.email,
        "Дата рождения": "15.05.2008",
        "Тип документа ОУ": "Аттестат о среднем общем образовании",
      },
      applications: applications.filter((a) => a.applicant_number === number),
      contracts: contracts.filter((c) => c.applicant_number === number),
    } satisfies PersonDetail;
  } else if (path === "/applications" && method === "POST") {
    const obj: Application = {
      ...body,
      id: Date.now(),
      total_score:
        Object.values(body.exam_scores as Record<string, number>).reduce(
          (a, b) => a + b,
          0,
        ) + body.achievements,
      exams: body.exam_scores,
      status: "participating",
    };
    applications.push(obj);
    people = people.map((p) =>
      p.number === obj.applicant_number
        ? {
            ...p,
            applications_count: p.applications_count + 1,
            best_score: Math.max(p.best_score, obj.total_score),
          }
        : p,
    );
    activity("Добавлено заявление", obj.direction);
    output = obj;
  } else if (path === "/rankings") {
    const lists = Object.fromEntries(
      ["general", "special", "separate", "target", "paid"].map((quota) => {
        const rows = inYear
          .filter(
            (a) =>
              a.direction === q.get("direction") &&
              a.campaign === q.get("campaign") &&
              a.study_form === q.get("study_form") &&
              a.quota === quota &&
              a.status !== "pending",
          )
          .sort((a, b) => b.total_score - a.total_score);
        let rank = 0;
        return [
          quota,
          rows.map((a, i): Rank => {
            if (!i || a.total_score !== rows[i - 1].total_score) rank = i + 1;
            return {
              applicant_number: a.applicant_number,
              application_id: a.id,
              score: a.total_score,
              rank,
              full_name: fullName(
                people.find((p) => p.number === a.applicant_number)!,
              ),
              consent: a.consent,
              priority: a.priority,
              status: a.status,
              direction: a.direction,
              quota: a.quota,
            };
          }),
        ];
      }),
    );
    output = {
      lists,
      seats: Object.fromEntries(
        ["general", "special", "separate", "target", "paid"].flatMap(
          (quota) => {
            const count =
              seats[
                JSON.stringify([
                  year,
                  q.get("direction"),
                  q.get("campaign"),
                  q.get("study_form"),
                  quota,
                ])
              ];
            return count !== undefined
              ? [[quota, count]]
              : quota === "general"
                ? [[quota, 25]]
                : [];
          },
        ),
      ),
    };
  } else if (path === "/seat-plans" && method === "PUT") {
    seats[
      JSON.stringify([
        body.year,
        body.direction,
        body.campaign,
        body.study_form,
        body.quota,
      ])
    ] = body.seats;
    activity("Обновлён план приёма", body.direction);
    output = body;
  } else if (path === "/contracts" && method === "GET") {
    output = page(
      contracts.filter(
        (c) =>
          inYear.some((a) => a.id === c.application_id) &&
          includes(`${c.full_name} ${c.number} ${c.applicant_number}`) &&
          (!q.get("stage") || c.stage === q.get("stage")) &&
          (!q.has("paid") || c.paid === (q.get("paid") === "true")),
      ),
    );
  } else if (path === "/contracts" && method === "POST") {
    const a = applications.find((a) => a.id === body.application_id);
    if (!a || a.quota !== "paid") throw new Error("Выберите платное заявление");
    if (
      contracts.some(
        (c) => c.application_id === a.id || c.number === body.number,
      )
    )
      throw new Error("Такой договор уже существует");
    const obj = {
      ...body,
      id: Date.now(),
      applicant_number: a.applicant_number,
      direction: a.direction,
      study_form: a.study_form,
      full_name: fullName(people.find((p) => p.number === a.applicant_number)!),
      location: "admissions",
      stage: "draft",
      paid: false,
      created_at: new Date().toISOString(),
    };
    contracts.unshift(obj);
    activity("Создан договор", body.number);
    output = obj;
  } else if (/^\/contracts\/\d+$/.test(path) && method === "PATCH") {
    const id = Number(path.split("/")[2]);
    const old = contracts.find((c) => c.id === id);
    if (!old) throw new Error("Договор не найден");
    output = { ...old, ...body };
    contracts = contracts.map((c) => (c.id === id ? (output as Contract) : c));
    history.set(id, [
      ...(history.get(id) || []),
      {
        at: new Date().toISOString(),
        actor: demoUser.display_name,
        changes: Object.fromEntries(
          Object.keys(body).map((k) => [
            k,
            { from: old[k as keyof Contract], to: body[k] },
          ]),
        ),
      },
    ]);
    activity("Изменён статус договора", old.number);
  } else if (/^\/contracts\/\d+\/history$/.test(path))
    output = history.get(Number(path.split("/")[2])) || [];
  else if (path === "/calls/queue") {
    const today = demoDate;
    const within = (deadline: string | null) =>
      !!deadline &&
      new Date(deadline).getTime() >= new Date(today).getTime() &&
      new Date(deadline).getTime() - new Date(today).getTime() <= 7 * 86400000;
    output =
      within(q.get("change_deadline")) || within(q.get("payment_deadline"))
        ? inYear
            .filter(
              (a) =>
                a.quota === "paid" &&
                !contracts.some(
                  (c) =>
                    c.application_id === a.id &&
                    (c.paid || c.stage === "cancelled"),
                ) &&
                results.get(a.id) !== "declined",
            )
            .map((a) => ({
              application_id: a.id,
              applicant_number: a.applicant_number,
              phone: "",
              direction: a.direction,
              priority_score:
                (a.consent ? 40 : 0) + (a.priority === 1 ? 25 : 0),
              method: "rules_v1",
              reasons: ["payment_deadline"],
              last_result: results.get(a.id) || null,
            }))
            .sort((a, b) => b.priority_score - a.priority_score)
        : [];
  } else if (path === "/calls" && method === "POST") {
    results.set(body.application_id, body.result);
    activity("Сохранён результат звонка", "Список обзвона");
    output = body;
  } else if (path === "/reports/statistics")
    output = {
      year,
      applicants: year === 2026 ? 10247 + added : 0,
      applications: year === 2026 ? 28614 : 0,
      statuses:
        year === 2026
          ? { participating: 24328, pending: 2130, enrolled: 2156 }
          : {},
      groups:
        year === 2026
          ? demoGroups.map((g, i) => ({
              ...g,
              quota: "general",
              applications: 128 + i * 41,
              active: 112 + i * 32,
              seats: 50 + i * 10,
              overcrowded: true,
            }))
          : [],
    };
  else if (path.startsWith("/imports/"))
    throw new Error(
      "Для загрузки Excel войдите в рабочую базу. Демо-режим не сохраняет файлы.",
    );
  else throw new Error("Эта операция доступна после входа в рабочую базу");
  return output as T;
}
