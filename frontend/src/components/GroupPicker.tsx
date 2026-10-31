import type { Group } from "../types";

export function GroupPicker({
  groups,
  index,
  onChange,
}: {
  groups: Group[];
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <label className="field group-picker">
      Конкурсная группа
      <select
        value={groups[index] ? index : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={!groups.length}
      >
        {!groups.length && <option>Нет конкурсных групп</option>}
        {groups.map((g, i) => (
          <option key={JSON.stringify(g)} value={i}>
            {g.direction} · {g.study_form} ·{" "}
            {g.campaign === "бак"
              ? "бакалавриат"
              : g.campaign === "маг"
                ? "магистратура"
                : g.campaign}
          </option>
        ))}
      </select>
    </label>
  );
}
