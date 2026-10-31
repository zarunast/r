import { useState } from "react";
import { CalendarDays, MessageSquare, Phone, PhoneCall } from "lucide-react";
import { demoDate } from "../demo";
import { jsonBody, useLoad, useStore } from "../store";
import { callLabels, params, type CallItem } from "../types";
import {
  Badge,
  Busy,
  Empty,
  ErrorState,
  Modal,
  PageHeading,
  SaveButton,
} from "../components/ui";

export function Calls() {
  const { year, demo, dates, setDates } = useStore();
  const { change, payment } = dates;
  const { data, loading, error } = useLoad<CallItem[]>(
    change && payment
      ? `/calls/queue?${params({ year, change_deadline: change, payment_deadline: payment })}`
      : null,
  );
  const [selected, setSelected] = useState<CallItem | null>(null);
  return (
    <>
      <PageHeading
        title="Звонки абитуриентам"
        subtitle="Помогайте поступающим вовремя оформить договор и оплатить обучение"
      >
        <span className="heading-chip">
          <PhoneCall size={16} />
          {data?.length || 0} в очереди
        </span>
      </PageHeading>
      <div className="panel call-settings">
        <div>
          <span className="settings-icon">
            <CalendarDays size={21} />
          </span>
          <div>
            <h3>Сроки приёмной кампании</h3>
            <p>Очередь формируется за 7 дней до каждого срока</p>
          </div>
        </div>
        <label className="field">
          Изменение направления
          <input
            type="date"
            value={change}
            onChange={(e) => {
              setDates({ change: e.target.value });
            }}
            required
          />
        </label>
        <label className="field">
          Закрытие оплаты
          <input
            type="date"
            value={payment}
            onChange={(e) => {
              setDates({ payment: e.target.value });
            }}
            required
          />
        </label>
      </div>
      <div className="notice-inline">
        Приоритет учитывает согласие, выбор направления и этап договора. Это
        оценка интереса, а не вероятность поступления.
        {demo &&
          ` Дата демо: ${new Date(demoDate).toLocaleDateString("ru-RU")}.`}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Список для обзвона</h2>
            <p>Платные заявления, которым требуется внимание</p>
          </div>
          <Badge tone="blue" dot={false}>
            По приоритету
          </Badge>
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : loading ? (
          <Busy />
        ) : !change || !payment ? (
          <Empty
            title="Укажите сроки кампании"
            text="Введите фактические даты изменения направления и закрытия оплаты, чтобы сформировать очередь."
          />
        ) : !data?.length ? (
          <Empty
            title="Звонков на выбранные сроки нет"
            text="Очередь появляется в последнюю неделю перед сроком. Оплаченные договоры и отказы исключаются."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Абитуриент</th>
                  <th>Направление</th>
                  <th>Телефон</th>
                  <th>Приоритет</th>
                  <th>Последний результат</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.application_id}>
                    <td>
                      <strong className="mono">{item.applicant_number}</strong>
                      <small className="block muted">Платное обучение</small>
                    </td>
                    <td>{item.direction}</td>
                    <td>
                      {item.phone ? (
                        <a
                          href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}
                          className="phone-link"
                        >
                          <Phone size={14} />
                          {item.phone}
                        </a>
                      ) : (
                        <span className="muted">Не указан</span>
                      )}
                    </td>
                    <td>
                      <div className="priority-cell">
                        <span
                          className={`priority-bars priority-${item.priority_score >= 65 ? "high" : "normal"}`}
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                        {item.priority_score >= 65
                          ? "Высокий"
                          : item.priority_score >= 40
                            ? "Средний"
                            : "Обычный"}
                      </div>
                    </td>
                    <td>
                      {item.last_result ? (
                        <Badge
                          tone={
                            item.last_result === "confirmed" ? "green" : "gray"
                          }
                          dot={false}
                        >
                          {callLabels[item.last_result]}
                        </Badge>
                      ) : (
                        <span className="muted">Ещё не звонили</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="button small"
                        onClick={() => setSelected(item)}
                      >
                        <MessageSquare size={15} />
                        Результат
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <CallResult item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function CallResult({
  item,
  onClose,
}: {
  item: CallItem;
  onClose: () => void;
}) {
  const { api, refresh, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Результат звонка"
      subtitle={`Абитуриент ${item.applicant_number} · ${item.direction}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api(
              "/calls",
              jsonBody({
                application_id: item.application_id,
                result: f.get("result"),
                comment: f.get("comment"),
              }),
            );
            refresh();
            notify("Результат звонка сохранён");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Как прошёл звонок?
          <select name="result" defaultValue="interested">
            {Object.entries(callLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Комментарий
          <textarea
            name="comment"
            placeholder="О чём договорились, когда перезвонить…"
            rows={4}
            maxLength={2000}
          />
        </label>
        {error && <ErrorState error={error} />}
        <div className="modal-footer">
          <button className="button" type="button" onClick={onClose}>
            Отмена
          </button>
          <SaveButton busy={busy} label="Сохранить результат" />
        </div>
      </form>
    </Modal>
  );
}
