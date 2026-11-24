import { useState } from "react";
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
          Создать договоры
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
  const { api, download, year, refresh, notify } = useStore();
  const [number, setNumber] = useState("");
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [selected, setSelected] = useState<Record<number, string>>({});
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
      title="Новые договоры"
      subtitle="Выберите платные заявления. Шаблон и номера подставятся автоматически."
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
            <fieldset>
              <legend>Платные заявления</legend>
              {eligible.map((application) => (
                <label key={application.id}>
                  <input
                    type="checkbox"
                    checked={application.id in selected}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelected((current) => {
                        const next = { ...current };
                        if (checked)
                          next[application.id] =
                            `${person.surname} ${person.first_name} · ${application.direction}`;
                        else delete next[application.id];
                        return next;
                      });
                    }}
                  />
                  {application.direction} · {application.study_form}
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="notice-inline">
              У абитуриента нет доступных платных заявлений в кампании {year}.
              Возможно, договор уже оформлен.
            </div>
          )}
        </>
      )}
      <ul>
        {Object.entries(selected).map(([id, label]) => (
          <li key={id}>
            {label}{" "}
            <button
              type="button"
              className="button"
              onClick={() =>
                setSelected((current) => {
                  const next = { ...current };
                  delete next[Number(id)];
                  return next;
                })
              }
            >
              Убрать
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="button primary"
        disabled={
          busy ||
          !Object.keys(selected).length ||
          Object.keys(selected).length > 50
        }
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await download(
              "/contracts/batch",
              "Договоры.zip",
              jsonBody({
                year,
                application_ids: Object.keys(selected).map(Number),
              }),
            );
            refresh();
            notify("Договоры созданы, архив сформирован");
            onClose();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Создать и скачать · {Object.keys(selected).length}
      </button>
      {error && <ErrorState error={error} />}
    </Modal>
  );
}

function CompleteContract({ id }: { id: number }) {
  const { download, notify } = useStore();
  const { data, loading, error } = useLoad<
    { key: string; label: string; value: string }[]
  >(`/contracts/${id}/document-fields`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  if (loading) return <Busy />;
  if (error) return <ErrorState error={error} />;
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        setBusy(true);
        setFailure("");
        try {
          await download(
            `/contracts/${id}/complete-document`,
            "Договор и допсоглашение.docx",
            jsonBody(fields, "POST"),
          );
          notify("Договор и допсоглашение сформированы");
        } catch (error) {
          setFailure((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-hint">
        Проверьте данные из карточки. Если программа и форма обучения найдены в
        тарифах БГТУ, стоимость первого курса и факультет уже подставлены.
        Укажите недостающие данные заказчика, полную стоимость и график оплаты.
      </p>
      <div className="form-grid">
        {data?.map(({ key, label, value }) => (
          <label className="field" key={key}>
            {label}
            <input name={key} required maxLength={240} defaultValue={value} />
          </label>
        ))}
      </div>
      {failure && <ErrorState error={failure} />}
      <button
        type="submit"
        className="button primary"
        disabled={busy || !data?.length}
      >
        {busy ? "Формирование…" : "Скачать заполненный Word"}
      </button>
    </form>
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
  const [paid, setPaid] = useState(contract.paid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showComplete, setShowComplete] = useState(false);
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
              jsonBody(
                { location, stage, paid: stage === "cancelled" ? false : paid },
                "PATCH",
              ),
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
        <label className="field">
          Статус оплаты
          <select
            value={paid && stage !== "cancelled" ? "paid" : "unconfirmed"}
            disabled={stage === "cancelled"}
            onChange={(event) => setPaid(event.target.value === "paid")}
          >
            <option value="unconfirmed">Оплата не подтверждена</option>
            <option value="paid">Оплата подтверждена</option>
          </select>
        </label>
        <p className="form-hint">
          Статус можно указать вручную по подтверждению бухгалтерии или
          загрузить выгрузку оплат.
        </p>
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button
            className="button"
            type="button"
            disabled={demo}
            onClick={async () => {
              setError("");
              try {
                await download(
                  `/contracts/${contract.id}/document`,
                  `${contract.number}.docx`,
                );
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <ArrowDownToLine size={16} />
            Скачать договор и допсоглашение
          </button>
          <a
            className="button"
            href={
              (import.meta.env.DEV ? "/api" : "") +
              "/public/admission/documents/tuition-contract-sample"
            }
          >
            Бланк договора PDF
          </a>
          <a
            className="button"
            href={
              (import.meta.env.DEV ? "/api" : "") +
              "/public/admission/documents/tuition-contract-addendum"
            }
          >
            Допсоглашение PDF
          </a>
          <SaveButton busy={busy} label="Обновить статус" />
        </div>
      </form>
      {!demo && (
        <details
          onToggle={(event) => setShowComplete(event.currentTarget.open)}
        >
          <summary>Заполнить договор и допсоглашение</summary>
          {showComplete && <CompleteContract id={contract.id} />}
        </details>
      )}
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
                            : {
                                true: "Подтверждена",
                                false: "Не подтверждена",
                              };
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
