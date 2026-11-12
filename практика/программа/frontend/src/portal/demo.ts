import type {
  Catalog,
  PublicGroup,
  PublicRank,
  Quota,
  SearchResult,
} from "./types";
import { quotaOrder } from "./types";

export const demoNumber = "001234567";
const profiles = [
  ["Программная инженерия", "09.03.04", "бак"],
  ["Информатика и вычислительная техника", "09.03.01", "бак"],
  ["Прикладная математика и информатика", "02.03.03", "бак"],
  ["Электроэнергетика и электротехника", "13.03.02", "бак"],
  ["Экономика", "38.03.01", "бак"],
  ["Машиностроение", "15.03.01", "бак"],
  ["Информатика и вычислительная техника", "09.04.01", "маг"],
  ["Математическое моделирование", "1.2.2", "асп"],
];
const groups: PublicGroup[] = profiles.map(
  ([direction, code, campaign], i) => ({
    direction,
    title: direction,
    code,
    categories: [...quotaOrder],
    campaign,
    study_form: "Очная",
    seats: {
      general: i === 1 ? 10 : 25 - i,
      special: 3,
      separate: 4,
      target: 5,
      paid: 30,
    },
    applications: {
      general: 32 - i,
      special: i === 2 ? 0 : 4,
      separate: 3,
      target: 7,
      paid: 15,
    },
  }),
);

function list(index: number, quota: Quota): PublicRank[] {
  const group = groups[index];
  return Array.from({ length: group.applications[quota] }, (_, i) => ({
    applicant_number:
      quota === "general" &&
      ((index === 0 && i === 6) || (index === 1 && i === 11))
        ? demoNumber
        : String(
            123000 + index * 300 + quotaOrder.indexOf(quota) * 50 + i,
          ).padStart(9, "0"),
    score: 279 - i * 3,
    quota,
    direction: group.direction,
    rank: i + 1,
  }));
}

export async function publicDemo<T>(path: string): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 160));
  const url = new URL(path, "http://demo.local");
  const year = Number(url.searchParams.get("year"));
  if (url.pathname === "/public/catalog")
    return {
      year,
      years: [2026],
      groups: year === 2026 ? groups : [],
    } as Catalog as T;
  if (url.pathname === "/public/rankings") {
    const index = groups.findIndex(
      (g) =>
        g.direction === url.searchParams.get("direction") &&
        g.campaign === url.searchParams.get("campaign") &&
        g.study_form === url.searchParams.get("study_form"),
    );
    return Object.fromEntries(
      quotaOrder.map((q) => [
        q,
        year === 2026 && index >= 0 ? list(index, q) : [],
      ]),
    ) as T;
  }
  if (url.pathname.startsWith("/public/applicants/")) {
    const number = decodeURIComponent(url.pathname.split("/").pop()!);
    const results: SearchResult[] = [];
    if (year === 2026)
      groups.forEach((g, i) =>
        quotaOrder.forEach((quota) => {
          const row = list(i, quota).find((r) => r.applicant_number === number);
          if (row)
            results.push({
              applicant_number: number,
              direction: g.direction,
              campaign: g.campaign,
              study_form: g.study_form,
              score: row.score,
              quota,
              forecast: {
                method: "rules_v1",
                probability: null,
                rank: row.rank,
                seats: g.seats[quota],
                assessment:
                  row.rank <= (g.seats[quota] ?? 0)
                    ? "within_seats"
                    : "outside_seats",
                factors: [
                  "Положение рассчитано по текущему рейтингу и плану мест.",
                  "Не учитывает будущие заявления, отзыв согласий и правила разрешения равных баллов. Это не гарантия зачисления.",
                ],
              },
            });
        }),
      );
    if (!results.length)
      throw new Error("Номер не найден. Проверьте номер ЕПГУ и год приёма.");
    return results as T;
  }
  if (url.pathname === "/public/faq") {
    const q = (url.searchParams.get("question") || "").toLowerCase();
    let answer =
      "Я могу подсказать, где найти номер ЕПГУ, какие документы подготовить, как читать рейтинг и оценку шансов. За индивидуальной консультацией обратитесь в приёмную комиссию БГТУ.";
    if (/номер|епгу/.test(q))
      answer =
        "Номер абитуриента указан в заявлении в личном кабинете Госуслуг. Введите его целиком, сохраняя нули в начале. ФИО и СНИЛС для поиска не нужны.";
    else if (/документ/.test(q))
      answer =
        "Обычно нужны паспорт, документ об образовании и СНИЛС. Перечень дополнительных документов и льгот уточняйте в официальных правилах приёма БГТУ.";
    else if (/срок|когда/.test(q))
      answer =
        "Сроки зависят от уровня образования, формы обучения и категории конкурса. Проверьте актуальный календарь на официальной странице приёмной комиссии БГТУ.";
    else if (/шанс|прогноз|мест/.test(q))
      answer =
        "Оценка сравнивает ваше место с планом мест в выбранной категории. Это расчёт текущего положения, а не обученная ИИ-модель или гарантия зачисления.";
    else if (/балл|рейтинг/.test(q))
      answer =
        "Рейтинг строится по итоговым баллам отдельно для каждого направления и категории. При одинаковых баллах место одинаковое. На портале списки обезличены.";
    else if (/договор|оплат/.test(q))
      answer =
        "Договор на платное обучение оформляется через приёмную комиссию. Персональные условия и оплату уточняйте у сотрудников, на открытом сайте они не отображаются.";
    return { answer } as T;
  }
  throw new Error("Неизвестный публичный запрос");
}
