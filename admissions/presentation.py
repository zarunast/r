"""Синтетическая база для показа сотрудникам приёмной комиссии."""
from sqlalchemy import select

from .db import Database
from .models import Applicant, Application, SeatPlan, User
from .security import add_user
from .services import create_contract, moscow_today, update_contract


DATABASE_URL = "sqlite:///data/presentation.sqlite3"
PASSWORD = "Bgtu-Demo-2026!"
PROGRAMS = (
    ("09.03.04", "Разработка программно-информационных систем", "Информатика"),
    ("15.03.05", "Технология машиностроения", "Механика"),
)
PEOPLE = (
    ("Новикова", "Ирина", "Алексеевна", 0, "paid", True, True),
    ("Орлов", "Даниил", "Павлович", 0, "paid", True, False),
    ("Волкова", "Мария", "Игоревна", 0, "paid", False, False),
    ("Соколов", "Егор", "Андреевич", 0, "general", True, False),
    ("Лебедева", "Вера", "Денисовна", 0, "general", False, False),
    ("Зайцев", "Артём", "Михайлович", 1, "paid", True, True),
    ("Крылова", "Анна", "Олеговна", 1, "paid", True, False),
    ("Белов", "Михаил", "Сергеевич", 1, "paid", False, False),
    ("Иванова", "Полина", "Романовна", 0, "paid", True, None),
    ("Андреев", "Никита", "Ильич", 1, "paid", True, None),
)


def seed_presentation(url=DATABASE_URL):
    db = Database(url)
    db.create_schema()
    try:
        with db.uow() as session:
            for login, role in (("demo-secretary", "operator"), ("demo-teacher", "examiner"),
                                ("demo-editor", "editor")):
                if not session.scalar(select(User.id).where(User.login == login)):
                    add_user(session, login, PASSWORD, role)
            for index, (surname, name, patronymic, program, quota, consent, paid) in enumerate(PEOPLE, 1):
                number = f"99000000{index:03}"
                if session.get(Applicant, number):
                    continue
                code, profile, subject = PROGRAMS[program]
                source = {"НПС/УГСН": code, "Обр.программа": profile,
                          "Дата получения документов": moscow_today().isoformat()}
                session.add(Applicant(number=number, surname=surname, first_name=name, patronymic=patronymic,
                                      profile={"Телефон": f"+700000000{index:02}", "Почта": f"demo{index}@example.invalid",
                                               "Адрес": "г. Брянск, ул. Демонстрационная, д. 1",
                                               "Серия": "0000", "Номер": f"{index:06}"}))
                session.flush()
                exams = {"Русский язык": 86 - index, "Математика": 90 - index, subject: 93 - index}
                group = {"year": 2026, "campaign": "Бакалавриат", "direction": f"{code} {profile}",
                         "study_form": "Очная", "quota": quota}
                application = Application(**group, applicant_number=number, exams=exams, achievements=5,
                                          total_score=sum(exams.values()) + 5, consent=consent,
                                          priority=1 if consent else 2, source=source)
                session.add(application)
                if not session.scalar(select(SeatPlan.id).filter_by(**group)):
                    session.add(SeatPlan(**group, seats=1 if quota == "paid" else 2))
                if quota == "paid" and paid is not None:
                    session.flush()
                    actor = "demo-secretary"
                    contract = create_contract(session, application.id, f"ДЕМО-2026-{index:03}", actor)
                    for stage in ("issued", "signed"):
                        update_contract(session, contract, actor, stage=stage)
                    if paid:
                        update_contract(session, contract, actor, stage="registered", paid=True)
    finally:
        db.engine.dispose()
