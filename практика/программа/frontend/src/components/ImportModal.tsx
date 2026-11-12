import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { useStore } from "../store";
import type { ImportReport } from "../types";
import { numberFormat } from "../types";
import { ErrorState, Modal, SaveButton } from "./ui";

export function ImportModal({
  kind,
  onClose,
}: {
  kind: "epgu" | "payments";
  onClose: () => void;
}) {
  const { api, demo, year, refresh, notify } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [report, setReport] = useState<
    | ImportReport
    | {
        confirmed: number;
        unchanged: number;
        errors: { row: number; error: string }[];
      }
    | null
  >(null);
  const input = useRef<HTMLInputElement>(null);
  const choose = (f?: File) => {
    if (!f) return;
    setError("");
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setError("Выберите файл Excel в формате .xlsx");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("Максимальный размер файла — 25 МБ");
      return;
    }
    setFile(f);
  };
  return (
    <Modal
      title={
        kind === "epgu" ? "Загрузка Excel-выгрузки" : "Подтверждение оплат"
      }
      subtitle={
        kind === "epgu"
          ? `Заявления и результаты экзаменов · кампания ${year}`
          : "Загрузите выгрузку подтверждённых оплат из бухгалтерии"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {report ? (
        <div className="import-result">
          <div className="result-icon">
            <CheckCircle2 size={34} />
          </div>
          <h3>Обработка завершена</h3>
          <p>Файл «{file?.name}»</p>
          <div className="import-counts">
            {"new_applicants" in report ? (
              <>
                <div>
                  <b>{numberFormat(report.new_applicants)}</b>
                  <span>новых абитуриентов</span>
                </div>
                <div>
                  <b>{numberFormat(report.new_applications)}</b>
                  <span>новых заявлений</span>
                </div>
                <div>
                  <b>{numberFormat(report.updated_applications)}</b>
                  <span>обновлено заявлений</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <b>{report.confirmed}</b>
                  <span>оплат подтверждено</span>
                </div>
                <div>
                  <b>{report.unchanged}</b>
                  <span>без изменений</span>
                </div>
              </>
            )}
          </div>
          {"warnings" in report &&
            report.warnings.map((w) => (
              <p className="notice-inline" key={w}>
                {w}
              </p>
            ))}
          {report.errors.length > 0 && (
            <div className="import-errors">
              <h4>Ошибки в {report.errors.length} строках</h4>
              {report.errors.map((e, i) => (
                <p key={i}>
                  Строка {e.row}: {e.error}
                </p>
              ))}
            </div>
          )}
          <div className="modal-footer">
            <button className="button primary" onClick={onClose}>
              Готово
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const form = new FormData();
              form.append("file", file);
              const result = await api<NonNullable<typeof report>>(
                kind === "epgu"
                  ? `/imports/epgu?year=${year}${sheet ? "&sheet=" + encodeURIComponent(sheet) : ""}`
                  : "/imports/payments",
                { method: "POST", body: form },
              );
              setReport(result);
              refresh();
              notify("Данные из Excel обработаны");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {demo && (
            <div className="notice-inline">
              Вы просматриваете демо. Для импорта в базу{" "}
              <a href="#/login" onClick={onClose}>
                войдите как сотрудник
              </a>
              .
            </div>
          )}
          <div
            className={`upload-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) choose(e.dataTransfer.files[0]);
            }}
          >
            {file ? (
              <>
                <span className="upload-icon">
                  <FileSpreadsheet size={28} />
                </span>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024 / 1024).toFixed(2)} МБ · Excel</span>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    if (input.current) input.current.value = "";
                  }}
                >
                  <X size={15} />
                  Выбрать другой файл
                </button>
              </>
            ) : (
              <>
                <span className="upload-icon">
                  <UploadCloud size={28} />
                </span>
                <strong>Перетащите Excel-файл сюда</strong>
                <span>или выберите файл на компьютере</span>
                <button
                  type="button"
                  className="button"
                  onClick={() => input.current?.click()}
                >
                  Выбрать файл
                </button>
                <small>XLSX · до 25 МБ</small>
              </>
            )}
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              className="sr-only"
              aria-label="Excel-файл для загрузки"
              onChange={(e) => choose(e.target.files?.[0])}
              disabled={busy}
            />
          </div>
          {kind === "epgu" ? (
            <label className="field">
              Лист книги <span className="muted">(если их несколько)</span>
              <input
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
                placeholder="Например, Лист1"
                disabled={busy}
              />
            </label>
          ) : (
            <p className="form-hint">
              В файле должны быть столбцы «Номер договора» и «Оплачен».
            </p>
          )}
          {error && <ErrorState error={error} />}
          <div className="modal-footer">
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Отмена
            </button>
            <SaveButton
              busy={busy}
              disabled={!file || demo}
              label="Загрузить данные"
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
