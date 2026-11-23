from datetime import date, datetime, timedelta, timezone
import io
import json
import sqlite3
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from docx import Document
from openpyxl import Workbook, load_workbook
from sqlalchemy import func, select

from .importer import integer, normalize, text
from .models import Applicant, Application, Call, Contract, ContractEvent, Quota, SeatPlan, now


ACTIVE = ("participating", "accepted", "enrolled")
LOCATIONS = {"admissions", "applicant", "accounting", "archive"}
TRANSITIONS = {
    "draft": {"issued", "cancelled"}, "issued": {"signed", "cancelled"},
    "signed": {"registered", "cancelled"}, "registered": {"cancelled"}, "cancelled": set(),
}


def moscow_today():
    try:
        zone = ZoneInfo("Europe/Moscow")
    except ZoneInfoNotFoundError:
        # Современные кампании используют UTC+3 даже без системной базы IANA.
        zone = timezone(timedelta(hours=3))
    return datetime.now(zone).date()


def require(session, model, key):
    obj = session.get(model, key)
    if obj is None:
        raise LookupError("Запись не найдена")
    return obj


def group_query(year, direction=None, campaign=None, study_form=None, quota=None):
    q = select(Application).where(Application.year == year)
    for name, value in {"direction": direction, "campaign": campaign, "study_form": study_form, "quota": quota}.items():
        if value is not None:
            q = q.where(getattr(Application, name) == value)
    return q


def ranking(session, year, direction, campaign, study_form, quota, *, public_flags=False):
    """Ничьи разрешаются номером для стабильности; это не правило приказа о зачислении."""
    q = group_query(year, direction, campaign, study_form, quota).where(Application.status.in_(ACTIVE))
    rows = session.scalars(q.order_by(Application.total_score.desc(), Application.applicant_number)).all()
    result = []
    previous = None
    place = 0
    for index, app in enumerate(rows, 1):
        if app.total_score != previous:
            place = index
        previous = app.total_score
        result.append({"applicant_number": app.applicant_number, "score": app.total_score,
                       "quota": app.quota, "direction": app.direction, "rank": place})
        if public_flags:
            result[-1].update(
                consent=app.consent,
                highest_priority=normalize(app.source.get("ОВП")) in {"да", "true", "истина", "1"},
                passing_priority=normalize(app.source.get("ВПП")) in {"да", "true", "истина", "1"},
            )
    return result


def all_rankings(session, year, direction, campaign, study_form, *, public_flags=False):
    return {q.value: ranking(session, year, direction, campaign, study_form, q.value,
                             public_flags=public_flags) for q in Quota}


def forecast(session, application):
    a = application
    rows = ranking(session, a.year, a.direction, a.campaign, a.study_form, a.quota)
    own = next((r for r in rows if r["applicant_number"] == a.applicant_number), None)
    seats = session.scalar(select(SeatPlan).where(
        SeatPlan.year == a.year, SeatPlan.campaign == a.campaign,
        SeatPlan.direction == a.direction, SeatPlan.study_form == a.study_form, SeatPlan.quota == a.quota))
    result = {"method": "rules_v1", "probability": None, "rank": own["rank"] if own else None,
              "seats": seats.seats if seats else None, "assessment": "unknown",
              "factors": ["Расчёт по текущему рейтингу, без обученной ИИ-модели и гарантии зачисления."]}
    if own is None:
        result["factors"].append("Заявление не участвует в действующем конкурсе.")
    elif seats is None:
        result["factors"].append("План мест не задан.")
    else:
        better = sum(r["score"] > a.total_score for r in rows)
        tied = sum(r["score"] == a.total_score for r in rows)
        if better >= seats.seats:
            result["assessment"] = "outside_seats"
        elif better + tied <= seats.seats:
            result["assessment"] = "within_seats"
        else:
            result["assessment"] = "tie_at_boundary"
        result["factors"].append("Не учитывает будущие заявления, отзыв согласий и правила разрешения равных баллов.")
    return result


def create_contract(session, application_id, number, actor):
    app = require(session, Application, application_id)
    if app.quota != Quota.PAID.value:
        raise ValueError("Договор доступен только для платного заявления")
    if app.status in {"withdrawn", "rejected"}:
        raise ValueError("Заявление отозвано или отклонено")
    if session.scalar(select(Contract).where((Contract.number == number) | (Contract.application_id == application_id))):
        raise ValueError("Договор с таким номером или для этого заявления уже существует")
    contract = Contract(number=number, application_id=application_id)
    session.add(contract)
    session.flush()
    session.add(ContractEvent(contract_id=contract.id, actor=actor,
                              changes={"created": True, "location": "admissions", "stage": "draft"}))
    return contract


def update_contract(session, contract, actor, *, location=None, stage=None, paid=None):
    changes = {}
    if location is not None and location not in LOCATIONS:
        raise ValueError("Неизвестное местоположение договора")
    if stage is not None and stage != contract.stage and stage not in TRANSITIONS[contract.stage]:
        raise ValueError("Недопустимый переход этапа договора")
    if paid is True and (stage or contract.stage) == "cancelled":
        raise ValueError("Нельзя подтвердить оплату отменённого договора")
    for field, value in {"location": location, "stage": stage, "paid": paid}.items():
        if value is not None and value != getattr(contract, field):
            changes[field] = {"from": getattr(contract, field), "to": value}
            setattr(contract, field, value)
    if changes:
        session.add(ContractEvent(contract_id=contract.id, actor=actor, changes=changes))
    return contract


def reconcile_payments(session, file, actor):
    """Файл подтверждённых полных оплат: номер договора + Оплачен. Отсутствие не отменяет оплату."""
    workbook = load_workbook(file, read_only=True, data_only=True)
    from .importer import boolean
    report = {"confirmed": 0, "unchanged": 0, "errors": []}
    try:
        rows = workbook.active.iter_rows(values_only=True)
        header = [normalize(v) for v in next(rows, ())]
        if "номердоговора" not in header or "оплачен" not in header:
            raise ValueError("В файле оплаты нужны столбцы «Номер договора», «Оплачен»")
        n, p = header.index("номердоговора"), header.index("оплачен")
        contracts = {c.number: c for c in session.scalars(select(Contract))}
        for line, row in enumerate(rows, 2):
            if not any(v is not None for v in row):
                continue
            try:
                contract = contracts.get(text(row[n]))
                if contract is None:
                    raise ValueError("Договор не найден")
                if not boolean(row[p]) or contract.paid:
                    report["unchanged"] += 1
                    continue
                update_contract(session, contract, actor, paid=True)
                report["confirmed"] += 1
            except ValueError as error:
                report["errors"].append({"row": line, "error": str(error)})
        return report
    finally:
        workbook.close()


def call_queue(session, year, change_deadline, payment_deadline, today=None):
    today = today or moscow_today()
    reasons = []
    if change_deadline - timedelta(days=7) <= today <= change_deadline:
        reasons.append("direction_deadline")
    if payment_deadline - timedelta(days=7) <= today <= payment_deadline:
        reasons.append("payment_deadline")
    if not reasons:
        return []
    apps = session.scalars(group_query(year, quota=Quota.PAID.value).where(Application.status.in_(ACTIVE)))
    contracts = {c.application_id: c for c in session.scalars(select(Contract).join(Application).where(Application.year == year))}
    last_calls = {}
    for call in session.scalars(select(Call).join(Application).where(Application.year == year).order_by(Call.at, Call.id)):
        last_calls[call.application_id] = call
    result = []
    for app in apps:
        contract = contracts.get(app.id)
        if contract and (contract.paid or contract.stage == "cancelled"):
            continue
        last = last_calls.get(app.id)
        if last and last.result == "declined":
            continue
        person = require(session, Applicant, app.applicant_number)
        score = (40 if app.consent else 0) + (25 if app.priority == 1 else 0)
        score += 30 if contract and contract.stage in {"signed", "registered"} else 0
        result.append({"application_id": app.id, "applicant_number": app.applicant_number,
                       "phone": person.profile.get("Телефон", ""), "direction": app.direction,
                       "priority_score": score, "method": "rules_v1", "reasons": reasons,
                       "last_result": last.result if last else None})
    return sorted(result, key=lambda r: (-r["priority_score"], r["applicant_number"], r["application_id"]))


def statistics(session, year):
    groups = session.execute(select(Application.direction, Application.campaign, Application.study_form,
                                    Application.quota, func.count(Application.id)).where(Application.year == year)
                             .group_by(Application.direction, Application.campaign, Application.study_form, Application.quota)).all()
    plans = {(p.direction, p.campaign, p.study_form, p.quota): p.seats
             for p in session.scalars(select(SeatPlan).where(SeatPlan.year == year))}
    statuses = dict(session.execute(select(Application.status, func.count()).where(Application.year == year)
                                   .group_by(Application.status)).all())
    active_counts = {(d, c, f, q): count for d, c, f, q, count in session.execute(
        select(Application.direction, Application.campaign, Application.study_form, Application.quota, func.count())
        .where(Application.year == year, Application.status.in_(ACTIVE))
        .group_by(Application.direction, Application.campaign, Application.study_form, Application.quota))}
    return {"year": year, "applications": sum(statuses.values()), "statuses": statuses,
            "applicants": session.scalar(select(func.count(func.distinct(Application.applicant_number))).where(Application.year == year)),
            "groups": [{"direction": d, "campaign": c, "study_form": f, "quota": q, "applications": count,
                        "active": active_counts.get((d, c, f, q), 0), "seats": plans.get((d, c, f, q)),
                        "overcrowded": active_counts.get((d, c, f, q), 0) > plans[(d, c, f, q)]
                        if (d, c, f, q) in plans else None} for d, c, f, q, count in groups]}


def xlsx_bytes(rows=None, *, sheets=None, columns=None):
    workbook = Workbook(write_only=True)
    def safe(value):
        # Запрещаем формулы из внешнего Excel в экспортируемых строках.
        return "'" + value if isinstance(value, str) and value.startswith(("=", "+", "-", "@")) else value

    for title, values in (sheets if sheets is not None else [("Отчёт", rows)]):
        sheet = workbook.create_sheet(title)
        headers = columns if columns is not None else list(values[0]) if values else []
        if headers:
            sheet.append(headers)
            for row in values:
                sheet.append([safe(row.get(key)) for key in headers])
    out = io.BytesIO()
    workbook.save(out)
    return out.getvalue()


QUOTA_TITLES = {
    "general": "Основной конкурс", "special": "Особая квота",
    "separate": "Отдельная квота", "target": "Целевая квота", "paid": "Платное обучение",
}


def enrollment_draft(session, group, ids, number, order_date, enrolled_at):
    conditions = {key: getattr(group, key) for key in ("year", "direction", "campaign", "study_form")}
    quota = group.quota.value
    plan = session.scalar(select(SeatPlan).filter_by(**conditions, quota=quota))
    if plan is None:
        raise ValueError("Сначала укажите количество мест для этой категории")
    candidates = session.scalars(group_query(**conditions, quota=quota).where(
        Application.id.in_(ids), Application.status.in_(("participating", "accepted")),
    ).order_by(Application.total_score.desc(), Application.applicant_number)).all()
    if len(candidates) != len(set(ids)):
        raise ValueError("Выберите действующие заявления из одного конкурсного списка")
    if len(candidates) != len({item.applicant_number for item in candidates}):
        raise ValueError("У одного абитуриента несколько выбранных заявлений")
    used = session.scalar(select(func.count()).select_from(group_query(**conditions, quota=quota).where(
        Application.status == "enrolled").subquery()))
    if len(candidates) + used > plan.seats:
        raise ValueError("Выбрано больше заявлений, чем осталось мест")
    already = session.scalar(select(Application.id).where(
        Application.year == group.year, Application.campaign == group.campaign,
        Application.applicant_number.in_([item.applicant_number for item in candidates]),
        Application.status == "enrolled").limit(1))
    if already is not None:
        raise ValueError("Среди выбранных есть уже зачисленный абитуриент этой кампании")
    if quota == "paid":
        paid = set(session.scalars(select(Contract.application_id).where(
            Contract.application_id.in_(ids), Contract.paid.is_(True), Contract.stage == "registered")))
        if any(item.id not in paid for item in candidates):
            raise ValueError("Для платного зачисления нужны зарегистрированные оплаченные договоры")
    elif any(not item.consent for item in candidates):
        raise ValueError("Для бюджетного зачисления требуется согласие каждого абитуриента")

    doc = Document()
    doc.add_paragraph("БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ ТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ")
    doc.add_heading("ПРОЕКТ ПРИКАЗА", 0)
    doc.add_paragraph(f"{order_date:%d.%m.%Y} · г. Брянск · № {number}")
    doc.add_heading("О зачислении на первый курс", level=1)
    doc.add_paragraph("Основание: решение приёмной комиссии, протокол № ____ от __________.")
    doc.add_paragraph("ПРИКАЗЫВАЮ:")
    doc.add_paragraph(f"Зачислить с {enrolled_at:%d.%m.%Y} абитуриентов, указанных в приложении. "
                      f"{group.campaign} · {group.direction} · {group.study_form} · {QUOTA_TITLES[quota]}.")
    doc.add_paragraph("Ректор ____________________")
    doc.add_page_break()
    doc.add_heading(f"Приложение к проекту приказа № {number}", level=1)
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    for cell, label in zip(table.rows[0].cells, ("№", "Идентификатор абитуриента", "Конкурсные баллы")):
        cell.text = label
    for position, item in enumerate(candidates, 1):
        for cell, value in zip(table.add_row().cells, (position, item.applicant_number, item.total_score)):
            cell.text = str(value)
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def pdf_bytes(rows):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
    font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    if not font.exists():
        raise ValueError("Для PDF нужен шрифт DejaVuSans.ttf (fonts-dejavu-core)")
    pdfmetrics.registerFont(TTFont("DejaVu", str(font)))
    out = io.BytesIO()
    columns = ["rank", "applicant_number", "score", "quota"]
    data = [["Место", "Номер абитуриента", "Баллы", "Квота"]]
    data += [[str(row.get(k, "")) for k in columns] for row in rows]
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
                               ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                               ("GRID", (0, 0), (-1, -1), .3, colors.grey)]))
    SimpleDocTemplate(out, pagesize=A4).build([table])
    return out.getvalue()


def render_contract(session, contract, template):
    """Маркеры {{name}} могут быть разбиты Word на несколько runs; оформление абзаца сохраняется частично."""
    app = require(session, Application, contract.application_id)
    person = require(session, Applicant, app.applicant_number)
    values = {"contract_number": contract.number, "applicant_number": person.number,
              "full_name": " ".join(filter(None, [person.surname, person.first_name, person.patronymic])),
              "direction": app.direction, "study_form": app.study_form, "year": str(app.year),
              "snils": person.profile.get("СНИЛС", ""), "passport_series": person.profile.get("Серия", ""),
              "passport_number": person.profile.get("Номер", ""), "date": now().date().isoformat()}
    document = Document(template)
    def replace_container(container):
        for paragraph in container.paragraphs:
            original = paragraph.text
            replaced = original
            for name, value in values.items():
                replaced = replaced.replace("{{" + name + "}}", value)
            if replaced != original:
                if paragraph.runs:
                    paragraph.runs[0].text = replaced
                    for run in paragraph.runs[1:]:
                        run.text = ""
                else:
                    paragraph.add_run(replaced)
            if "{{" in replaced:
                raise ValueError("В шаблоне есть неподдерживаемый маркер")
        for table in container.tables:
            for row in table.rows:
                for cell in row.cells:
                    replace_container(cell)
    replace_container(document)
    for section in document.sections:
        replace_container(section.header)
        replace_container(section.footer)
    out = io.BytesIO()
    document.save(out)
    return out.getvalue()


def export_1c(session, year, format="json"):
    records = []
    contracts = {c.application_id: c for c in session.scalars(select(Contract))}
    for app, person in session.execute(select(Application, Applicant).join(Applicant)
                                      .where(Application.year == year, Application.status == "enrolled",
                                             Application.enrolled_at.is_not(None))):
        contract = contracts.get(app.id)
        records.append({"applicant_number": person.number,
                        "full_name": " ".join(filter(None, [person.surname, person.first_name, person.patronymic])),
                        "passport_series": person.profile.get("Серия", ""),
                        "passport_number": person.profile.get("Номер", ""), "snils": person.profile.get("СНИЛС", ""),
                        "direction": app.direction, "study_form": app.study_form,
                        "enrolled_at": app.enrolled_at.date().isoformat(), "contract_number": contract.number if contract else None})
    if format == "json":
        return json.dumps({"schema_version": 1, "students": records}, ensure_ascii=False).encode()
    if format != "xml":
        raise ValueError("Формат должен быть json или xml")
    root = Element("students", schema_version="1")
    for record in records:
        child = SubElement(root, "student")
        for key, value in record.items():
            SubElement(child, key).text = value or ""
    return tostring(root, encoding="utf-8", xml_declaration=True)


def backup_database(db, destination):
    path = Path(destination)
    source_path = db.engine.url.database
    if source_path == ":memory:" or path.resolve() == Path(source_path).resolve():
        raise ValueError("Нужны файловая БД и отдельный путь резервной копии")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise ValueError("Резервная копия по этому пути уже существует")
    # sqlite backup API корректно учитывает WAL и параллельные транзакции.
    connection = db.engine.raw_connection()
    try:
        with sqlite3.connect(path) as target:
            connection.driver_connection.backup(target)
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("Проверка резервной копии не пройдена")
    finally:
        connection.close()
    path.chmod(0o600)
    return str(path)


FAQ = {
    "номер": "Номер абитуриента указан в заявлении в личном кабинете Госуслуг (ЕПГУ). Введите его полностью, включая нули в начале. ФИО, паспорт и СНИЛС для поиска на портале не нужны.",
    "епгу": "Номер абитуриента находится в заявлении на Госуслугах. Сохраните все ведущие нули при поиске. Не отправляйте паспортные данные и СНИЛС в чат.",
    "шанс": "Оценка сравнивает текущее место в рейтинге с планом мест по выбранной категории. Она не гарантирует зачисления и не является обученной ИИ-моделью. Без плана мест оценка недоступна.",
    "прогноз": "Оценка основана на текущем рейтинге и плане мест. Будущие заявления, отзыв согласий и официальное разрешение ничьих могут изменить результат. Решение о зачислении оформляется приказом.",
    "документ": "Подготовьте паспорт, документ об образовании и СНИЛС. Перечень льготных документов уточните в комиссии.",
    "договор": "Для платного обучения договор оформляет приёмная комиссия; статус и оплату уточняйте у секретаря.",
    "рейтинг": "Рейтинг доступен по номеру абитуриента, направлению, форме обучения и категории конкурса.",
    "срок": "Даты устанавливаются ежегодными правилами приёма БГТУ. Уточните актуальные сроки в комиссии.",
    "соглас": "Порядок подачи согласия уточняйте в действующих правилах приёма БГТУ и в личном кабинете Госуслуг. Открытый портал не принимает согласия и не заменяет официальное заявление.",
    "зачисл": "Зачисление подтверждается приказом университета. Место в конкурсном списке и оценка положения не являются приказом о зачислении.",
}


def chatbot(question):
    question = question.lower()
    if "договор" in question or "оплат" in question:
        return FAQ["договор"]
    if "когда" in question:
        return FAQ["срок"]
    for word, answer in FAQ.items():
        if word in question:
            return answer
    return "Уточните вопрос о документах, договоре, рейтинге или сроках. За индивидуальной консультацией обратитесь в комиссию."
