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
    "priority": ["Приоритет"], "status": ["Статус"], "consent": ["Согласие"],
}
REVERSE = {normalize(alias): name for name, aliases in ALIASES.items() for alias in aliases}
REQUIRED = {"number", "direction", "campaign", "study_form", "category", "total_score"}
EXAMS = {
    "Математика", "Прикладная математика", "Информатика", "Прикладная информатика",
    "Физика", "Химия", "Механика", "Основы электротехники и электроники",
    "Обществознание", "Основы экономики", "История", "Основы педагогики",
    "Иностранный язык", "Русский язык", "Междисциплинарный экзамен", "Специальная дисциплина",
}
STATUS = {normalize(k): v for k, v in {
    "Участвует в конкурсе": "participating", "На рассмотрении": "pending",
    "Принято": "accepted", "Зачислен": "enrolled", "Зачислена": "enrolled",
    "Отозвано": "withdrawn", "Отозван": "withdrawn", "Отклонено": "rejected",
}.items()}


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
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    def as_dict(self):
        return asdict(self)


def application_key(obj):
    get = obj.get if isinstance(obj, dict) else lambda k: getattr(obj, k)
    return tuple(get(k) for k in ("applicant_number", "year", "campaign", "direction", "study_form", "quota"))


def read_epgu(path, year, sheet=None):
    if not 2000 <= year <= 2100:
        raise ValueError("Укажите год приемной кампании (2000–2100)")
    report = ImportReport()
    workbook = load_workbook(path, read_only=True, data_only=True)
    parsed = []
    try:
        if sheet is None and len(workbook.sheetnames) != 1:
            raise ValueError("В книге несколько листов: укажите sheet явно")
        ws = workbook[sheet] if sheet else workbook.active
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
        seen = set()
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
                profile = {k: v for k, v in raw.items() if k in personal}
                applicant = {"number": number, "surname": text(get("surname")),
                             "first_name": text(get("first_name")), "patronymic": text(get("patronymic")),
                             "profile": profile}
                status_raw = normalize(get("status", "Участвует в конкурсе"))
                if status_raw not in STATUS:
                    raise ValueError("Неизвестный статус заявления")
                app = dict(applicant_number=number, year=year, campaign=text(get("campaign")),
                           direction=text(get("direction")), study_form=text(get("study_form")),
                           quota=quota_for(get("category")), priority=integer(get("priority", 1), "Приоритет", 1, 100),
                           status=STATUS[status_raw], total_score=integer(get("total_score"), "Сумма баллов"),
                           achievements=integer(get("achievements", 0) or 0, "Общие ИД", 0, 100),
                           exams={k: integer(v, k, 0, 100) for k, v in raw.items() if k in EXAMS and v},
                           consent=boolean(get("consent", False)), source=raw)
                if any(not app[k] for k in ("campaign", "direction", "study_form")):
                    raise ValueError("Не заполнены направление, форма или кампания")
                key = application_key(app)
                if key in seen:
                    raise ValueError("Повтор заявления в одном файле")
                seen.add(key)
                parsed.append((applicant, app))
            except ValueError as error:
                report.errors.append({"sheet": ws.title, "row": line, "error": str(error)})
        report.warnings.append("Сумма баллов взята из итогового столбца; альтернативные экзамены не суммируются.")
        report.warnings.append("Выгрузка обновляет присутствующие заявления; отсутствующие автоматически не удаляются.")
        return parsed, report
    finally:
        workbook.close()


def import_epgu(db, path, year, sheet=None):
    parsed, report = read_epgu(path, year, sheet)
    with db.uow() as session:
        applicants = {a.number: a for a in session.scalars(select(Applicant))}
        applications = {application_key(a): a for a in session.scalars(select(Application).where(Application.year == year))}
        updated = set()
        fresh = set()
        desired = {}
        conflicts = set()
        for values, _ in parsed:
            previous = desired.get(values["number"])
            if previous and previous != values:
                conflicts.add(values["number"])
            desired[values["number"]] = values
        if conflicts:
            report.warnings.append(f"У {len(conflicts)} абитуриентов различаются персональные поля в строках; использована последняя строка файла.")
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
                values = {**values, "profile": {**existing.profile, **values["profile"]}}
                if any(getattr(existing, k) != v for k, v in values.items()):
                    for k, v in values.items():
                        setattr(existing, k, v)
                    existing.updated_at = now()
                    updated.add(number)
        session.flush()
        for _, values in parsed:
            key = application_key(values)
            existing = applications.get(key)
            if existing is None:
                session.add(Application(**values))
                report.new_applications += 1
            else:
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
        report.new_applicants = len(fresh)
        report.updated_applicants = len(updated - fresh)
    return report
