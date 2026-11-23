type Page = readonly [id: string, title: string, href?: string];

export type Section = {
  id: string;
  title: string;
  pages: readonly Page[];
};

export const official = "https://www.tu-bryansk.ru/abiturient/";
export const rankings = "#/admission/rankings";
export const programs = "#/programs";

export const sections: Section[] = [
  {
    id: "commission",
    title: "Приёмная комиссия",
    pages: [
      ["contacts", "Контакты"],
      ["preparation", "Подготовительные курсы"],
      ["faq", "Вопрос-ответ"],
      ["graduates", "Выпускники о нас"],
      ["news", "Новости"],
      ["events", "События"],
    ],
  },
  {
    id: "admission",
    title: "Приём 2026",
    pages: [
      ["rules", "Правила приёма. Поступление 2026"],
      ["bachelor", "Бакалавриат и специалитет"],
      ["quota", "Отдельная квота"],
      ["master", "Магистратура"],
      [
        "undergraduate-tests",
        "Вступительные испытания — бакалавриат и специалитет",
      ],
      ["graduate-tests", "Вступительные испытания — магистратура"],
      ["orders", "Приказы о зачислении в 2026 году"],
      ["postgraduate", "Аспирантура"],
      ["college", "Среднее профессиональное образование"],
      ["target", "Целевое обучение"],
      ["rankings", "Списки поступающих"],
    ],
  },
  {
    id: "programs",
    title: "Специальности и направления подготовки",
    pages: [],
  },
  {
    id: "documents",
    title: "Документы и справки",
    pages: [
      ["internal", "Внутренние документы"],
      ["federal", "Федеральные документы"],
    ],
  },
  {
    id: "student-life",
    title: "Студенческая жизнь",
    pages: [
      ["housing", "Предоставление общежитий"],
      ["scholarships", "Стипендии и материальная поддержка"],
      ["activities", "Внеучебная и воспитательная деятельность"],
      ["council", "Студенческое самоуправление"],
      ["community", "Общественная деятельность"],
      ["culture", "Культурно-творческая деятельность"],
      ["sports", "Физкультура, спорт и туризм"],
      ["careers", "Трудоустройство выпускников"],
      ["research", "Студенческая наука в БГТУ"],
      ["contacts", "Полезные контакты"],
      ["resources", "Полезные интернет-ресурсы"],
      ["alumni", "Наши выпускники"],
    ],
  },
  {
    id: "international",
    title: "Иностранным гражданам",
    pages: [],
  },
  {
    id: "accessibility",
    title: "Абитуриентам с ОВЗ",
    pages: [],
  },
];

export const news = [
  ["2026-08-18", "Поступающим на платной основе"],
  ["2026-07-18", "Встреча с руководством ФЭЭ"],
  ["2026-07-07", "Встреча с руководством ФОЦЭ"],
  ["2026-05-15", "День открытых дверей 23 мая"],
] as const;

export const events = [
  ["2026-02-16", "День открытых дверей БГТУ"],
  ["2025-07-15", "Встреча с руководством факультета энергетики и электроники"],
  ["2025-07-07", "Встреча для абитуриентов и родителей"],
  ["2025-07-03", "Встреча с руководством ФЭЭ"],
] as const;
