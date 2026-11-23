import { useState } from "react";
import { PublicRatings } from "../portal/Ratings";
import { PortalProvider, usePortal, usePublicLoad } from "../portal/state";
import {
  groupKey,
  levelName,
  primaryQuota,
  quotaOrder,
  type Catalog,
  type Quota,
} from "../portal/types";
import { PortalNotice } from "../portal/ui";
import portalStyles from "../portal/portal.css?inline";

function RankingsContent() {
  const { year, setYear, demo, setDemo } = usePortal();
  const catalog = usePublicLoad<Catalog>(`/public/catalog?year=${year}`);
  const [group, setGroup] = useState("");
  const [form, setForm] = useState("");
  const [funding, setFunding] = useState("");
  const [level, setLevel] = useState("");
  const [highestPriorityOnly, setHighestPriorityOnly] = useState(false);
  const [passingConsentOnly, setPassingConsentOnly] = useState(false);
  const [category, setCategory] = useState<Quota | null>(null);
  const allGroups = catalog.data?.groups ?? [];
  const forms = [...new Set(allGroups.map((item) => item.study_form))];
  const levels = [...new Set(allGroups.map((item) => item.campaign))];
  const visibleQuotas = quotaOrder.filter(
    (quota) =>
      !funding ||
      (funding === "budget"
        ? quota !== "paid" && quota !== "target"
        : quota === funding),
  );
  const groups = allGroups.filter(
    (item) =>
      (!form || item.study_form === form) &&
      (!level || item.campaign === level) &&
      (!funding ||
        item.categories.some((quota) => visibleQuotas.includes(quota))),
  );
  const selected = groups.find((item) => groupKey(item) === group) ?? groups[0];
  const selectedQuota = selected && primaryQuota(selected);
  const years = [...new Set([year, ...(catalog.data?.years ?? [])])].sort(
    (a, b) => b - a,
  );

  return (
    <div className="workspace-rankings-panel">
      <div className="workspace-rankings-toolbar">
        <h2>Список подавших документы</h2>
        <div className="commission-filters">
          <label>
            Год приёма
            <select
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value));
                setForm("");
                setLevel("");
                setFunding("");
                setGroup("");
                setCategory(null);
              }}
            >
              {years.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Форма обучения
            <select
              value={form}
              onChange={(event) => {
                setForm(event.target.value);
                setCategory(null);
              }}
            >
              <option value="">Все формы</option>
              {forms.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Уровень подготовки
            <select
              value={level}
              onChange={(event) => {
                setLevel(event.target.value);
                setCategory(null);
              }}
            >
              <option value="">Все квалификации</option>
              {levels.map((value) => (
                <option key={value} value={value}>
                  {levelName(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Основа обучения
            <select
              value={funding}
              onChange={(event) => {
                setFunding(event.target.value);
                setCategory(null);
              }}
            >
              <option value="">Бюджет и платное</option>
              <option value="budget">Бюджет</option>
              <option value="paid">Платное</option>
              <option value="target">Целевое</option>
            </select>
          </label>
          <label className="commission-checkbox">
            <input
              type="checkbox"
              checked={demo}
              onChange={(event) => {
                setDemo(event.target.checked);
                setLevel("");
                setForm("");
                setFunding("");
                setGroup("");
                setCategory(null);
              }}
            />
            Демо-режим
          </label>
        </div>
      </div>
      <fieldset className="workspace-rankings-options">
        <legend>Текущий конкурс</legend>
        <label className="commission-checkbox">
          <input
            type="checkbox"
            checked={highestPriorityOnly}
            onChange={(event) => setHighestPriorityOnly(event.target.checked)}
          />
          С учётом высшего приоритета (ОВП)
        </label>
        <label className="commission-checkbox">
          <input
            type="checkbox"
            checked={passingConsentOnly}
            onChange={(event) => setPassingConsentOnly(event.target.checked)}
          />
          Только с согласием на высшем проходном приоритете (ВПП)
        </label>
      </fieldset>
      {demo && <p role="status">Демонстрационные списки и номера вымышлены.</p>}
      {catalog.error && <PortalNotice error>{catalog.error}</PortalNotice>}
      <PublicRatings
        groups={groups}
        selected={selected}
        onSelect={(item) => {
          setGroup(groupKey(item));
          setCategory(null);
        }}
        quota={
          category ??
          (selectedQuota && visibleQuotas.includes(selectedQuota)
            ? selectedQuota
            : (visibleQuotas.find((quota) =>
                selected?.categories.includes(quota),
              ) ?? visibleQuotas[0]))
        }
        visibleQuotas={visibleQuotas}
        highestPriorityOnly={highestPriorityOnly}
        passingConsentOnly={passingConsentOnly}
        onQuota={setCategory}
        highlight=""
        loadingCatalog={catalog.loading}
      />
    </div>
  );
}

export default function Rankings() {
  return (
    <section className="interior workspace-rankings">
      <style>{`@scope (.workspace-rankings) { ${portalStyles} }`}</style>
      <h1>Списки поступающих</h1>
      <div className="admissions-portal">
        <PortalProvider>
          <RankingsContent />
        </PortalProvider>
      </div>
    </section>
  );
}
