import { ArrowUpRight, Clock3 } from "lucide-react";
import { useState } from "react";
import { useLoad } from "../store";
import { initials, type Activity, type Result } from "../types";
import { Badge, Busy, Empty, ErrorState, Modal, Pagination } from "./ui";

const statuses: Record<string, [string, string]> = {
  success: ["Выполнено", "green"],
  info: ["Готово", "blue"],
  paid: ["Оплачено", "green"],
  warning: ["Проверить", "amber"],
};
export function ActivityTable({ full = false }: { full?: boolean }) {
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useLoad<Result<Activity>>(
    `/activities?limit=${full ? 15 : 6}&offset=${offset}`,
  );
  const [selected, setSelected] = useState<Activity | null>(null);
  return (
    <>
      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>{full ? "Журнал действий" : "Последняя активность"}</h2>
            <p>Операции сотрудников и системные события</p>
          </div>
          {!full && (
            <a className="button small" href="#/activity">
              Все действия
              <ArrowUpRight size={15} />
            </a>
          )}
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : loading && !data ? (
          <Busy />
        ) : !data?.items.length ? (
          <Empty
            title="История пока пуста"
            text="Здесь будут появляться загрузки файлов и действия сотрудников."
          />
        ) : (
          <div className="table-scroll">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Пользователь</th>
                  <th>Действие</th>
                  <th>Статус</th>
                  <th>Объект</th>
                  <th className="row-action" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => {
                  const [defaultLabel, tone] = statuses[item.status] || [
                    "Выполнено",
                    "green",
                  ];
                  const label =
                    item.status === "success" &&
                    /импорт|выгрузк/i.test(item.action)
                      ? "Загружено"
                      : defaultLabel;
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.status === "warning" ? "attention-row" : ""
                      }
                    >
                      <td className="muted time-cell">
                        {new Date(item.at).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Moscow",
                        })}
                      </td>
                      <td>
                        <div className="person-cell">
                          <span
                            className={`avatar avatar-small avatar-${i % 4}`}
                          >
                            {initials(item.actor)}
                          </span>
                          <div>
                            <strong>{item.actor}</strong>
                            <small>{item.role || "Сотрудник комиссии"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{item.action}</td>
                      <td>
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td>
                        <div className="table-two-lines">
                          <strong>{item.object}</strong>
                          <small>{item.detail || "Приёмная кампания"}</small>
                        </div>
                      </td>
                      <td>
                        <button
                          className="icon-button row-open"
                          aria-label={`Подробнее: ${item.action}`}
                          onClick={() => setSelected(item)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {full ? (
          <Pagination
            total={data?.total || 0}
            offset={offset}
            limit={15}
            onChange={setOffset}
          />
        ) : (
          <div className="activity-footer">
            <span>
              <Clock3 size={13} />
              Данные обновляются при выполнении операций
            </span>
            <a href="#/activity">
              Открыть журнал
              <ArrowUpRight size={13} />
            </a>
          </div>
        )}
      </section>
      {selected && (
        <Modal title="Событие системы" onClose={() => setSelected(null)}>
          <dl className="detail-list">
            <div>
              <dt>Дата и время</dt>
              <dd>
                {new Date(selected.at).toLocaleString("ru-RU", {
                  timeZone: "Europe/Moscow",
                })}
              </dd>
            </div>
            <div>
              <dt>Сотрудник</dt>
              <dd>{selected.actor}</dd>
            </div>
            <div>
              <dt>Действие</dt>
              <dd>{selected.action}</dd>
            </div>
            <div>
              <dt>Объект</dt>
              <dd>{selected.object}</dd>
            </div>
            {selected.detail && (
              <div>
                <dt>Подробности</dt>
                <dd>{selected.detail}</dd>
              </div>
            )}
          </dl>
        </Modal>
      )}
    </>
  );
}
