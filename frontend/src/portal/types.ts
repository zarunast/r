import type { Group, Quota } from "../types";
export type { Quota };
export type PublicGroup = Group & {
  title: string;
  code: string | null;
  categories: Quota[];
  seats: Record<Quota, number | null>;
  applications: Record<Quota, number>;
};
export type Catalog = { year: number; years: number[]; groups: PublicGroup[] };
export type PublicRank = {
  applicant_number: string;
  score: number;
  quota: Quota;
  direction: string;
  rank: number;
};
export type PublicRankings = Record<Quota, PublicRank[]>;
export type Forecast = {
  method: string;
  probability: number | null;
  rank: number | null;
  seats: number | null;
  assessment: "unknown" | "within_seats" | "outside_seats" | "tie_at_boundary";
  factors: string[];
};
export type SearchResult = Group & {
  applicant_number: string;
  score: number;
  quota: Quota;
  forecast: Forecast;
};
export const official = "https://www.tu-bryansk.ru/abiturient/";
export const government = "https://www.gosuslugi.ru/vuzonline";
export const groupKey = (g: Group) =>
  JSON.stringify([g.direction, g.campaign, g.study_form]);
export const levelName = (campaign: string) =>
  ({ бак: "Бакалавриат", маг: "Магистратура", асп: "Аспирантура" })[campaign] ||
  campaign;
export const quotaOrder: Quota[] = [
  "general",
  "special",
  "separate",
  "target",
  "paid",
];
export const primaryQuota = (group: PublicGroup): Quota =>
  quotaOrder.find((q) => group.applications[q] > 0) ||
  quotaOrder.find((q) => group.seats[q] !== null) ||
  group.categories[0] ||
  "general";
export const fundingLabel = (group: PublicGroup) => {
  const paid = group.categories.includes("paid");
  const budget = group.categories.some((q) => q !== "paid");
  return paid && budget
    ? "Бюджет и платное"
    : paid
      ? "Платное обучение"
      : budget
        ? "Бюджет"
        : "Условия уточняются";
};
