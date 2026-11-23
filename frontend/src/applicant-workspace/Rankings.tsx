import { useState } from "react";
import { PublicRatings } from "../portal/Ratings";
import { PortalProvider, usePortal, usePublicLoad } from "../portal/state";
import {
  groupKey,
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
  const [category, setCategory] = useState<Quota | null>(null);
  const allGroups = catalog.data?.groups ?? [];
  const forms = [...new Set(allGroups.map((item) => item.study_form))];
  const groups = allGroups.filter((item) => {
    return (
      (!form || item.study_form === form) &&
      (!funding ||
        item.categories.some((quota) =>
          funding === "paid" ? quota === "paid" : quota !== "paid",
        ))
    );
  });
  const selected = groups.find((item) => groupKey(item) === group) ?? groups[0];
  const visibleQuotas = quotaOrder.filter((quota) =>
    funding === "paid"
      ? quota === "paid"
      : funding === "budget"
        ? quota !== "paid"
        : true,
  );
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
            </select>
          </label>
          <label className="commission-checkbox">
            <input
              type="checkbox"
              checked={demo}
              onChange={(event) => {
                setDemo(event.target.checked);
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
