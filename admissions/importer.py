"""Потоковое чтение ЕПГУ без потери ведущих нулей и альтернативных экзаменов."""
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
import re

from openpyxl import load_workbook
from sqlalchemy import select

from .models import Applicant, Application, Quota, now


def normalize(value):
    return re.sub(r"[^а-яa-z0-9]", "", str(value or "").lower().replace("ё", "е"))


ALIASES = {
    "number": ["Идентификатор", "Номер абитуриента", "ID абитуриента"],
    "direction": ["Направление", "Направление подготовки"],
    "campaign": ["Приемная кампания", "Уровень образования"],
    "study_form": ["Форма обучения"],
    "category": ["Категория", "Квота", "Основание приема"],
    "total_score": ["Сумма баллов", "Итоговый балл", "Суммарный балл"],
    "achievements": ["Общие ИД", "Баллы ИД", "Индивидуальные достижения"],
    "surname": ["Фамилия"], "first_name": ["Имя"], "patronymic": ["Отчество"],
    "priority": ["Приоритет"], "status": ["Статус"], "consent": ["Согласие", "Наличие согласия"],
}
REVERSE = {normalize(alias): name for name, aliases in ALIASES.items() for alias in aliases}
REQUIRED = {"number", "direction", "campaign", "study_form", "category"}
EXAMS = {
    "Математика", "Прикладная математика", "Информатика", "Прикладная информатика",
    "Физика", "Химия", "Механика", "Основы электротехники и электроники",
    "Обществознание", "Основы экономики", "История", "Основы педагогики",
    "Иностранный язык", "Русский язык", "Междисциплинарный экзамен", "Специальная дисциплина",
}
STATUS = {normalize(k): v for k, v in {
    "Участвует в конкурсе": "participating", "На рассмотрении": "pending",
    "Новое": "new", "Не прошло по конкурсу": "not_competitive",
    "Включено в приказ на зачисление": "in_enrollment_order", "Отказ от зачисления": "declined",
    "Принято": "accepted", "Зачислен": "enrolled", "Зачислена": "enrolled",
    "Отозвано": "withdrawn", "Отозван": "withdrawn", "Отклонено": "rejected",
}.items()}


ADDRESS_HEADERS = {"адрес", "адреспроживания", "адресрегистрации", "адресместажительства",
                   "адресместарегистрации", "адресфактическогопроживания", "адреспрописки"}


def text(value):
    if value is None:
        return ""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def integer(value, name, low=0, high=1000):
    try:
        number = float(str(value).replace(",", "."))
        if not number.is_integer() or not low <= number <= high:
            raise ValueError
        return int(number)
    except (ValueError, TypeError, OverflowError):
        raise ValueError(f"Некорректное числовое поле: {name}") from None


def boolean(value):
    n = normalize(value)
    if n in {"да", "истина", "true", "1"}:
        return True
    if n in {"", "нет", "ложь", "false", "0"}:
        return False
    raise ValueError("Неизвестное значение логического поля")


def quota_for(value):
    n = normalize(value)
    aliases = {
        "бюдж": Quota.GENERAL, "бюджет": Quota.GENERAL, "основнойнабор": Quota.GENERAL,
        "общийконкурс": Quota.GENERAL, "general": Quota.GENERAL,
        "плат": Quota.PAID, "платное": Quota.PAID, "платноеобучение": Quota.PAID,
        "договор": Quota.PAID, "paid": Quota.PAID,
        "особаяквота": Quota.SPECIAL, "special": Quota.SPECIAL,
        "отдельнаяквота": Quota.SEPARATE, "separate": Quota.SEPARATE,
        "целевое": Quota.TARGET, "целевоенаправление": Quota.TARGET,
        "целеваяквота": Quota.TARGET, "target": Quota.TARGET,
    }
    if n not in aliases:
        raise ValueError("Неизвестная категория приема: требуется явное сопоставление")
    return aliases[n].value


@dataclass
class ImportReport:
    rows: int = 0
    new_applicants: int = 0
    updated_applicants: int = 0
    new_applications: int = 0
    updated_applications: int = 0
    unchanged_applications: int = 0
    statuses: dict = field(default_factory=dict)
    status_changes: int = 0
    absent_applications: int = 0
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    def as_dict(self):
        return asdict(self)


def application_key(obj):
    get = obj.get if isinstance(obj, dict) else lambda k: getattr(obj, k)
    return tuple(get(k) for k in ("applicant_number", "year", "campaign", "direction", "study_form", "quota"))


def has_imported_total(source):
    return any(text(value) and REVERSE.get(normalize(key)) == "total_score"
               for key, value in source.items())


def backfill_missing_scores(session):
    """Восстановить итоги у заявлений, импортированных прежней версией."""
    from .exam_policy import inferred_total

    for app in session.scalars(select(Application).where(Application.total_score == 0).execution_options(yield_per=500)):
        if (has_imported_total(app.source) or app.source.get("_score_calculated")
                or not any(REVERSE.get(normalize(key)) == "number" for key in app.source)):
            continue
        total = inferred_total(app.direction, app.source, app.exams, app.achievements)
        if total is not None:
            app.total_score = total
            app.source = {**app.source, "_score_calculated": True}


def read_epgu(path, year, sheet=None):
    if not 2000 <= year <= 2100:
        raise ValueError("Укажите год приемной кампании (2000–2100)")
    from .exam_policy import inferred_total

    report = ImportReport()
    workbook = load_workbook(path, read_only=True, data_only=True)
    parsed = []
    try:
        if sheet and sheet not in workbook.sheetnames:
            raise ValueError("Указанный лист отсутствует в книге")
        candidates = [workbook[sheet]] if sheet else [
            ws for ws in workbook if any(
                REQUIRED.issubset({REVERSE.get(normalize(cell)) for cell in row})
                for row in ws.iter_rows(max_row=20, values_only=True)
            )
        ]
        if len(candidates) != 1:
            raise ValueError("Нужен один лист заявлений. Если их несколько, укажите sheet явно")
        ws = candidates[0]
        rows = ws.iter_rows(values_only=True)
        header = None
        for line, row in enumerate(rows, 1):
            fields = [REVERSE.get(normalize(v)) for v in row]
            if REQUIRED.issubset(set(fields)):
                duplicates = [k for k, v in Counter(x for x in fields if x).items() if v > 1]
                if duplicates:
                    raise ValueError("Неоднозначные заголовки: " + ", ".join(duplicates))
                header = [text(v) for v in row]
                positions = {v: i for i, v in enumerate(fields) if v}
                header_line = line
                break
            if line == 20:
                break
        if header is None:
            raise ValueError("Не найдена строка заголовков. Нужны: " + ", ".join(sorted(REQUIRED)))
        seen = {}
        duplicates = 0
        for line, row in enumerate(rows, header_line + 1):
            if all(v is None for v in row):
                continue
            report.rows += 1
            get = lambda name, default=None: row[positions[name]] if name in positions else default
            try:
                number = text(get("number"))
                if not re.fullmatch(r"[0-9A-Za-z_-]{1,64}", number):
                    raise ValueError("Отсутствует или некорректен номер абитуриента")
                # Числовая ячейка с форматом 000000000 иначе потеряла бы ведущие нули.
                if isinstance(get("number"), (int, float)):
                    raise ValueError("Номер абитуриента должен быть текстом: иначе ведущие нули неизвестны")
                raw = {k: text(v) for k, v in zip(header, row) if k}
                personal = {"Пол", "Дата рождения", "Место рождения", "Телефон", "Почта", "СНИЛС",
                            "ДУЛ", "Серия", "Номер", "Страна выдачи", "Дата выдачи",
                            "Тип документа ОУ", "Дата выдачи ОУ", "Организация, выдавшая документ ОУ",
                            "Наличие ОУ", "Документы доп.", "Необходимость в общежитии"}
                profile = {k: v for k, v in raw.items() if k in personal or normalize(k) in ADDRESS_HEADERS
                           or k.endswith((" посл", " пред"))}
                applicant = {"number": number, "surname": text(get("surname")),
                             "first_name": text(get("first_name")), "patronymic": text(get("patronymic")),
                             "profile": profile}
                status_raw = normalize(get("status", "Участвует в конкурсе"))
                if status_raw not in STATUS:
                    raise ValueError("Неизвестный статус заявления")
                app = dict(applicant_number=number, year=year, campaign=text(get("campaign")),
                           direction=text(get("direction")), study_form=text(get("study_form")),
                           quota=quota_for(get("category")), priority=integer(get("priority", 1), "Приоритет", 1, 100),
                           status=STATUS[status_raw], total_score=integer(get("total_score") or 0, "Сумма баллов"),
                           achievements=integer(get("achievements", 0) or 0, "Общие ИД", 0, 100),
                           exams={k: integer(v, k, 0, 100) for k, v in raw.items() if k in EXAMS and v},
                           consent=boolean(get("consent", False)), source=raw)
                if not has_imported_total(raw):
                    estimate = inferred_total(app["direction"], raw, app["exams"], app["achievements"])
                    if estimate is not None:
                        app["total_score"] = estimate
                        raw["_score_calculated"] = True
                if any(not app[k] for k in ("campaign", "direction", "study_form")):
                    raise ValueError("Не заполнены направление, форма или кампания")
                key = application_key(app)
                if key in seen:
                    previous_person, previous_app = parsed[seen[key]]
                    if previous_app["source"] == raw:
                        raise ValueError("Повтор заявления в одном файле")
                    old_raw = {**previous_app["source"], "Статус": raw.get("Статус")}
                    if previous_person != applicant or old_raw != raw:
                        raise ValueError("Повтор заявления с различающимися данными")
                    duplicates += 1
                    parsed[seen[key]] = (applicant, app)
                else:
                    seen[key] = len(parsed)
                    parsed.append((applicant, app))
            except ValueError as error:
                report.errors.append({"sheet": ws.title, "row": line, "error": str(error)})
        report.statuses = dict(Counter(app["status"] for _, app in parsed))
        if "total_score" in positions:
            report.warnings.append("Сумма баллов взята из итогового столбца; альтернативные экзамены не суммируются.")
        else:
            report.warnings.append("В книге нет столбца «Сумма баллов». Готовые итоги, ранее сохранённые в системе, сохраняются.")
        report.warnings.append("Если итоговая ячейка отсутствует или пуста, сумма рассчитывается по программе при наличии всех нужных оценок.")
        if duplicates:
            report.warnings.append(f"Повторные строки одного заявления: {duplicates}. Принят статус последней строки, остальные поля совпадают.")
        report.warnings.append("Выгрузка обновляет присутствующие заявления; отсутствующие автоматически не удаляются.")
        return parsed, report
    finally:
        workbook.close()


def snapshot_date(filename):
    match = re.search(r"(?<![0-9])([0-9]{8})(?![0-9])", Path(filename).stem)
    if match:
        try:
            return datetime.strptime(match[1], "%Y%m%d").date().isoformat()
        except ValueError:
            pass
    return ""


def import_epgu(db, path, year, sheet=None, *, filename=None):
    parsed, report = read_epgu(path, year, sheet)
    snapshot = snapshot_date(filename or path)
    with db.uow() as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        applicants = {a.number: a for a in session.scalars(select(Applicant))}
        applications = {application_key(a): a for a in session.scalars(select(Application).where(Application.year == year))}
        newest = max((app.source.get("_snapshot_date", "") for app in applications.values()), default="")
        if snapshot and snapshot < newest:
            report.warnings.append(f"Книга от {snapshot} старше загруженной выгрузки от {newest}. Данные не изменены.")
            return report
        updated = set()
        fresh = set()
        desired = {}
        conflicts = set()
        for values, _ in parsed:
            previous = desired.get(values["number"])
            if previous and previous != values:
                conflicts.add(values["number"])
            if previous:
                values = {**previous, **{k: v for k, v in values.items() if k != "profile" and v},
                          "profile": {**previous["profile"], **{k: v for k, v in values["profile"].items() if v}}}
            desired[values["number"]] = values
        if conflicts:
            report.warnings.append(f"У {len(conflicts)} абитуриентов различаются персональные поля в строках; использованы последние непустые значения.")
        for values in desired.values():
            number = values["number"]
            existing = applicants.get(number)
            if existing is None:
                existing = Applicant(**values)
                applicants[number] = existing
                session.add(existing)
                fresh.add(number)
            else:
                # Локальные поля (например, родитель) сохраняются при ежедневном импорте.
                values = {**values, "profile": {**existing.profile, **{k: v for k, v in values["profile"].items() if v}}}
                for key in ("surname", "first_name", "patronymic"):
                    values[key] = values[key] or getattr(existing, key)
                if any(getattr(existing, k) != v for k, v in values.items()):
                    for k, v in values.items():
                        setattr(existing, k, v)
                    existing.updated_at = now()
                    updated.add(number)
        session.flush()
        imported_keys = {application_key(values) for _, values in parsed}
        if snapshot and not report.errors:
            scopes = {(values["campaign"], values["study_form"]) for _, values in parsed}
            for key, app in applications.items():
                if (key not in imported_keys and app.source.get("_snapshot_date") and
                        app.source["_snapshot_date"] < snapshot and (app.campaign, app.study_form) in scopes):
                    report.absent_applications += 1
                    app.source = {**app.source, "_missing_from_snapshot": snapshot}
        for _, values in parsed:
            key = application_key(values)
            if snapshot:
                values["source"]["_snapshot_date"] = snapshot
            existing = applications.get(key)
            if existing is None:
                session.add(Application(**values))
                report.new_applications += 1
            else:
                prior_source = existing.source
                current_source = values["source"]
                values["source"] = {**prior_source, **current_source}
                if has_imported_total(current_source):
                    values["source"].pop("_score_calculated", None)
                elif (has_imported_total(prior_source) or
                      (existing.total_score and not prior_source.get("_score_calculated"))):
                    values["total_score"] = existing.total_score
                    values["source"].pop("_score_calculated", None)
                    for key, value in prior_source.items():
                        if REVERSE.get(normalize(key)) == "total_score" and text(value):
                            values["source"][key] = value
                elif not current_source.get("_score_calculated"):
                    values["source"].pop("_score_calculated", None)
                if snapshot:
                    values["source"].pop("_missing_from_snapshot", None)
                if existing.status != values["status"] and not existing.enrolled_at:
                    report.status_changes += 1
                    values["source"]["_previous_status"] = existing.status
                    values["source"]["_previous_snapshot_date"] = prior_source.get("_snapshot_date", "")
                # Приказ о зачислении — локальное действие, его не отменяет старый Excel.
                if existing.enrolled_at:
                    values = {**values, "status": "enrolled", "source": {
                        **values["source"], "enrollment_order": existing.source.get("enrollment_order")}}
                if any(getattr(existing, k) != v for k, v in values.items()):
                    for k, v in values.items():
                        setattr(existing, k, v)
                    report.updated_applications += 1
                else:
                    report.unchanged_applications += 1
        if year == 2026 and parsed:
            from .seat_reference import seed_seat_plans
            session.flush()
            seeded = seed_seat_plans(session, year)
            if seeded:
                report.warnings.append(f"Добавлено позиций плана приёма БГТУ: {seeded}.")
        report.new_applicants = len(fresh)
        report.updated_applicants = len(updated - fresh)
    return report
