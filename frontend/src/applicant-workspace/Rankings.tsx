import { useState } from "react";
import { PublicRatings } from "../portal/Ratings";
import { PortalProvider, usePortal, usePublicLoad } from "../portal/state";
import {
  groupKey,
  primaryQuota,
  type Catalog,
  type Quota,
} from "../portal/types";
import { PortalNotice } from "../portal/ui";
import portalStyles from "../portal/portal.css?inline";

function RankingsContent() {
  const { year, setYear, demo, setDemo } = usePortal();
  const catalog = usePublicLoad<Catalog>(`/public/catalog?year=${year}`);
  const [group, setGroup] = useState("");
  const [category, setCategory] = useState<Quota | null>(null);
  const groups = catalog.data?.groups ?? [];
  const selected = groups.find((item) => groupKey(item) === group) ?? groups[0];
  const years = [...new Set([year, ...(catalog.data?.years ?? [])])].sort(
    (a, b) => b - a,
  );

  return (
    <>
      <div className="commission-filters">
        <label>
          Год приёма
          <select
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setGroup("");
              setCategory(null);
            }}
          >
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="commission-checkbox">
          <input
            type="checkbox"
            checked={demo}
            onChange={(event) => {
              setDemo(event.target.checked);
              setGroup("");
              setCategory(null);
            }}
          />
          Демо-режим
        </label>
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
        quota={category ?? (selected ? primaryQuota(selected) : "general")}
        onQuota={setCategory}
        highlight=""
        loadingCatalog={catalog.loading}
      />
    </>
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
