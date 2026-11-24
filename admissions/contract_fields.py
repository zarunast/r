"""Данные для договора и дополнительного соглашения."""
import json
from pathlib import Path
import re

from .importer import ADDRESS_HEADERS, normalize, text
from .models import Applicant, Application

FIELDS = {
    "contract_date": "Дата договора",
    "addendum_date": "Дата допсоглашения",
    "customer_name": "ФИО или наименование заказчика",
    "customer_representative": "Представитель заказчика и должность (или «Не применяется»)",
    "customer_authority": "Основание полномочий (или «Не применяется»)",
    "customer_birth": "Дата рождения заказчика (или «Не применяется»)",
    "customer_address": "Адрес заказчика",
    "customer_passport": "Паспорт заказчика (или реквизиты организации)",
    "customer_bank": "Банковские реквизиты заказчика (или «Не применяется»)",
    "customer_phone": "Телефон заказчика",
    "full_name": "ФИО обучающегося",
    "student_birth": "Дата рождения обучающегося",
    "student_address": "Адрес обучающегося",
    "student_passport": "Паспорт обучающегося: серия, номер, кем и когда выдан",
    "student_bank": "Банковские реквизиты обучающегося (или «Не применяется»)",
    "student_email": "Электронная почта обучающегося",
    "student_phone": "Телефон обучающегося",
    "faculty": "Факультет, институт или колледж",
    "program_title": "Образовательная программа",
    "program_direction": "Форма обучения, код и направление",
    "study_duration": "Срок обучения",
    "individual_duration": "Срок по индивидуальному плану (или «Не применяется»)",
    "qualification_document": "Документ о квалификации",
    "student_category": "Категория обучающегося",
    "total_cost": "Полная стоимость (сумма цифрами и прописью, в рублях)",
    "year_cost": "Стоимость за учебный год (сумма цифрами и прописью, в рублях)",
    "semester_cost": "Стоимость за семестр (сумма цифрами и прописью, в рублях)",
    "payment_first": "Первый платёж (сумма цифрами и прописью, в рублях)",
    "payment_first_date": "Срок первого платежа",
    "payment_second": "Второй платёж (сумма цифрами и прописью, в рублях)",
    "payment_second_date": "Срок второго платежа",
    "academic_year": "Учебный год допсоглашения",
    "first_academic_year": "Учебный год начала обучения",
    "contract_copies": "Количество экземпляров договора",
    "addendum_copies": "Количество экземпляров допсоглашения",
}

TEMPLATE = Path(__file__).with_name("admission_2026") / "documents" / "contract-with-addendum.docx"
TARIFFS = json.loads((Path(__file__).with_name("admission_2026") / "tuition-2026.json").read_text(encoding="utf-8"))
PROGRAM_CODE = re.compile(r"(?<!\d)\d{2}\.\d{2}\.\d{2}(?!\d)")
AMOUNTS_IN_WORDS = {
    146850: "сто сорок шесть тысяч восемьсот пятьдесят",
    74800: "семьдесят четыре тысячи восемьсот",
    70550: "семьдесят тысяч пятьсот пятьдесят",
    161300: "сто шестьдесят одна тысяча триста",
    75900: "семьдесят пять тысяч девятьсот",
    98900: "девяносто восемь тысяч девятьсот",
    54000: "пятьдесят четыре тысячи",
}


def tuition_defaults(app):
    if app.year != TARIFFS["year"]:
        return {}
    direction = text(app.source.get("НПС/УГСН")) or app.direction
    match = PROGRAM_CODE.search(direction)
    if not match:
        return {}
    code = match.group()
    profile = normalize(app.source.get("Обр.программа"))
    if not profile:
        profile = normalize(PROGRAM_CODE.sub("", app.direction, count=1))
    exact, general = set(), set()
    for form, amount, faculty, programs in TARIFFS["groups"]:
        if normalize(form) != normalize(app.study_form):
            continue
        for entry in programs:
            if entry == code:
                general.add((amount, faculty))
            elif isinstance(entry, list) and entry[0] == code and profile in {normalize(name) for name in entry[1:]}:
                exact.add((amount, faculty))
    matches = exact or general
    if len(matches) != 1:
        return {}
    amount, faculty = matches.pop()
    result = {"faculty": faculty}
    if amount is not None:
        formatted = f"{amount:,}".replace(",", " ")
        result["year_cost"] = f"{formatted},00 ({AMOUNTS_IN_WORDS[amount]})"
        result["academic_year"] = "2026–2027"
    return result


def imported_address(profile, source):
    values = {normalize(key): text(value) for key, value in {**source, **profile}.items()
              if normalize(key) in ADDRESS_HEADERS and text(value)}
    for key in ("адресместажительства", "адресфактическогопроживания", "адреспроживания",
                "адрес", "адресместарегистрации", "адресрегистрации", "адреспрописки"):
        if values.get(key):
            return values[key]
    return ""


def defaults(session, contract):
    app = session.get(Application, contract.application_id)
    person = session.get(Applicant, app.applicant_number)
    profile = {key: text(value) for data in (app.source, person.profile)
               for key, value in data.items() if text(value)}
    passport_number = " ".join(filter(None, [profile.get("Серия"), profile.get("Номер")]))
    return {
        "full_name": " ".join(filter(None, [person.surname, person.first_name, person.patronymic])),
        "student_birth": profile.get("Дата рождения", ""),
        "student_address": imported_address(profile, app.source),
        "student_phone": profile.get("Телефон") or text(app.source.get("Телефон")),
        "student_email": profile.get("Почта") or text(app.source.get("Электронная почта")),
        "student_passport": ", ".join(filter(None, [
            profile.get("ДУЛ"), passport_number, profile.get("Кем выдан"),
            profile.get("Дата выдачи"), profile.get("Страна выдачи"),
        ])),
        "program_title": text(app.source.get("Обр.программа")) or app.direction,
        "program_direction": " · ".join((app.study_form, text(app.source.get("НПС/УГСН")) or app.direction)),
        "first_academic_year": f"{app.year}–{app.year + 1}",
        **tuition_defaults(app),
        **({"faculty": profile["Факультет"]} if profile.get("Факультет") else {}),
    }


def draft_document(session, contract):
    from .services import render_contract

    values = defaults(session, contract)
    date = contract.created_at.strftime("%d.%m.%Y")
    filled = {"contract_date": date, "addendum_date": date, "academic_year": values["first_academic_year"],
              "contract_copies": "2", "addendum_copies": "2"}
    return render_contract(session, contract, TEMPLATE, {
        key: filled.get(key) or values.get(key) or "____________________"
        for key in FIELDS
    })
