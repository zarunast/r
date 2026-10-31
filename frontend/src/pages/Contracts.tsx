import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FileCheck2,
  History,
  Plus,
  Search,
} from "lucide-react";
import { jsonBody, useDebounce, useLoad, useStore } from "../store";
import {
  locationLabels,
  numberFormat,
  params,
  stageLabels,
  type Contract,
  type PersonDetail,
  type Result,
} from "../types";
import {
  Badge,
  Busy,
  Empty,
  ErrorState,
  Modal,
  PageHeading,
  Pagination,
  SaveButton,
} from "../components/ui";

export function Contracts({ onPayments }: { onPayments: () => void }) {
  const { year } = useStore();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [paid, setPaid] = useState("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Contract | null>(null);
  const query = useDebounce(search);
  const { data, loading, error } = useLoad<Result<Contract>>(
    `/contracts?${params({ year, q: query, stage, paid, offset, limit: 20 })}`,
  );
  return (
    <>
      <PageHeading
        title="Договоры на обучение"
        subtitle="Оформление, подписание и подтверждение оплаты"
      >
        <button className="button" onClick={onPayments}>
          <FileCheck2 size={17} />
          Загрузить оплаты
        </button>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={17} />
          Создать договор
        </button>
      </PageHeading>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Номер договора, ФИО или номер абитуриента"
              aria-label="Поиск договора"
            />
          </div>
          <span className="filter-count">
            {numberFormat(data?.total || 0)} договоров
          </span>
        </div>
        <div className="filter-options">
          <select
            aria-label="Этап договора"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Все этапы</option>
            {Object.entries(stageLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Статус оплаты"
            value={paid}
            onChange={(e) => {
              setPaid(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Любая оплата</option>
            <option value="true">Оплачен</option>
            <option value="false">Не оплачен</option>
          </select>
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : loading ? (
          <Busy />
        ) : !data?.items.length ? (
          <Empty
            title="Договоры не найдены"
            text="Измените фильтры или создайте договор для платного заявления."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Номер договора</th>
                  <th>Абитуриент / направление</th>
                  <th>Где находится</th>
                  <th>Этап</th>
                  <th>Оплата</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => setSelected(c)}
                      >
                        {c.number}
                      </button>
                      <small className="block muted">
                        {new Date(c.created_at).toLocaleDateString("ru-RU")}
                      </small>
                    </td>
                    <td>
                      <div className="table-two-lines">
                        <strong>{c.full_name}</strong>
                        <small>{c.direction}</small>
                      </div>
                    </td>
                    <td>{locationLabels[c.location]}</td>
                    <td>
                      <Badge
                        tone={
                          c.stage === "registered"
                            ? "green"
                            : c.stage === "cancelled"
                              ? "gray"
                              : "blue"
                        }
                      >
                        {stageLabels[c.stage]}
                      </Badge>
                    </td>
                    <td>
                      {c.paid ? (
                        <Badge tone="green">
                          <Check size={11} />
                          Оплачен
                        </Badge>
                      ) : (
                        <Badge tone="amber" dot={false}>
                          Ожидает оплаты
                        </Badge>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Открыть договор ${c.number}`}
                        onClick={() => setSelected(c)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          total={data?.total || 0}
          offset={offset}
          limit={20}
          onChange={setOffset}
        />
      </section>
      {creating && <CreateContract onClose={() => setCreating(false)} />}
      {selected && (
        <ContractModal contract={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function CreateContract({ onClose }: { onClose: () => void }) {
  const { api, year, refresh, notify } = useStore();
  const [number, setNumber] = useState("");
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible =
    person?.applications.filter(
      (a) =>
        a.year === year &&
        a.quota === "paid" &&
        !person.contracts.some((c) => c.application_id === a.id) &&
        !["withdrawn", "rejected"].includes(a.status),
    ) || [];
  return (
    <Modal
      title="Новый договор"
      subtitle="Договор оформляется для платного заявления"
      onClose={onClose}
    >
      <div className="contract-lookup">
        <label className="field">
          Номер абитуриента
          <input
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setPerson(null);
            }}
            placeholder="Номер ЕПГУ"
          />
        </label>
        <button
          className="button"
          disabled={!number || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setPerson(
                await api<PersonDetail>(
                  `/applicants/${encodeURIComponent(number)}`,
                ),
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Search size={16} />
          Найти
        </button>
      </div>
      {person && (
        <>
          <p className="lookup-person">
            {person.surname} {person.first_name} {person.patronymic}
          </p>
          {eligible.length ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  await api(
                    "/contracts",
                    jsonBody({
                      application_id: Number(f.get("application_id")),
                      number: f.get("contract_number"),
                    }),
                  );
                  refresh();
                  notify("Договор создан");
                  onClose();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                Платное заявление
                <select name="application_id">
                  {eligible.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.direction} · {a.study_form}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Номер договора
                <input
                  name="contract_number"
                  placeholder={`Д-${year}-0001`}
                  required
                  maxLength={100}
                />
              </label>
              <div className="modal-footer">
                <SaveButton busy={busy} label="Создать договор" />
              </div>
            </form>
          ) : (
            <div className="notice-inline">
              У абитуриента нет доступных платных заявлений в кампании {year}.
              Возможно, договор уже оформлен.
            </div>
          )}
        </>
      )}
      {error && <ErrorState error={error} />}
    </Modal>
  );
}

function ContractModal({
  contract,
  onClose,
}: {
  contract: Contract;
  onClose: () => void;
}) {
  const { api, refresh, notify, download, demo } = useStore();
  const [location, setLocation] = useState(contract.location);
  const [stage, setStage] = useState(contract.stage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const history = useLoad<
    {
      at: string;
      actor: string;
      changes: Record<
        string,
        { from?: unknown; to?: unknown } | boolean | string
      >;
    }[]
  >(`/contracts/${contract.id}/history`);
  const allowed: Record<string, string[]> = {
    draft: ["issued", "cancelled"],
    issued: ["signed", "cancelled"],
    signed: ["registered", "cancelled"],
    registered: ["cancelled"],
    cancelled: [],
  };
  return (
    <Modal
      title={`Договор № ${contract.number}`}
      subtitle={`${contract.full_name} · ${contract.direction}`}
      onClose={onClose}
      wide
    >
      <div className="contract-summary">
        <span>
          <FileCheck2 size={21} />
          Платное обучение
        </span>
        <Badge tone={contract.paid ? "green" : "amber"}>
          {contract.paid ? "Оплата подтверждена" : "Оплата не подтверждена"}
        </Badge>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              `/contracts/${contract.id}`,
              jsonBody({ location, stage }, "PATCH"),
            );
            refresh();
            notify("Статус договора обновлён");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Где находится
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {Object.entries(locationLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            На каком этапе
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {Object.entries(stageLabels).map(([k, v]) => (
                <option
                  key={k}
                  value={k}
                  disabled={
                    k !== contract.stage && !allowed[contract.stage].includes(k)
                  }
                >
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="form-hint">
          Оплата подтверждается только загрузкой выгрузки из бухгалтерии.
        </p>
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button
            className="button"
            type="button"
            onClick={() => {
              if (demo) {
                setError("Генерация DOCX доступна после входа в рабочую базу");
                return;
              }
              input.current?.click();
            }}
          >
            <ArrowDownToLine size={16} />
            Договор Word
          </button>
          <SaveButton busy={busy} label="Обновить статус" />
        </div>
      </form>
      <input
        ref={input}
        type="file"
        accept=".docx"
        className="sr-only"
        aria-label="Шаблон договора Word"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const form = new FormData();
            form.append("template", file);
            await download(
              `/contracts/${contract.id}/document`,
              "contract.docx",
              { method: "POST", body: form },
            );
            notify("Договор Word сформирован");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      <div className="history-heading">
        <History size={17} />
        <h4>История изменений</h4>
      </div>
      {history.error ? (
        <ErrorState error={history.error} />
      ) : history.loading ? (
        <Busy />
      ) : history.data?.length ? (
        <div className="history-list">
          {history.data.map((event, i) => (
            <div key={i}>
              <span className="timeline-dot" />
              <div>
                <strong>{event.actor}</strong>
                <p>
                  {Object.entries(event.changes)
                    .map(([k, v]) => {
                      const labels =
                        k === "stage"
                          ? stageLabels
                          : k === "location"
                            ? locationLabels
                            : {};
                      return typeof v === "object" && v !== null
                        ? `${k === "stage" ? "Этап" : k === "location" ? "Местоположение" : "Оплата"}: ${labels[String(v.to)] || String(v.to)}`
                        : k === "created"
                          ? "Договор создан"
                          : `${k}: ${String(v)}`;
                    })
                    .join(" · ")}
                </p>
                <small>
                  {new Date(event.at).toLocaleString("ru-RU", {
                    timeZone: "Europe/Moscow",
                  })}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted form-hint">Изменений пока не было.</p>
      )}
    </Modal>
  );
}
