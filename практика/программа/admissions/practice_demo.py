"""Вымышленные данные для автономного учебного стенда."""
from sqlalchemy import select

from .db import Database
from .models import Applicant, Application, SeatPlan, User
from .security import add_user
from .services import create_contract, moscow_today, update_contract


URL = "sqlite:///data/practice-demo.sqlite3"
LOGIN = "practice-secretary"
PASSWORD = "Practice-2026!BGTU"
DIRECTIONS = (
    "09.02.07 Информационные системы и программирование",
    "15.02.16 Технология машиностроения",
)


def seed():
    db = Database(URL)
    db.create_schema()
    try:
        with db.uow() as session:
            if not session.scalar(select(User.id).where(User.login == LOGIN)):
                add_user(session, LOGIN, PASSWORD)
            records = (
                ("Волкова", "Анна", 491, 0, "general"),
                ("Орлов", "Илья", 475, 0, "general"),
                ("Лебедева", "Мария", 462, 0, "general"),
                ("Петров", "Артём", 448, 0, "paid"),
                ("Соколова", "Вера", 432, 0, "paid"),
                ("Крылов", "Максим", 480, 1, "general"),
                ("Андреева", "Ольга", 416, 1, "paid"),
            )
            for index, (surname, name, grade, direction, quota) in enumerate(records, 1):
                number = f"0009000{index:02}"
                if session.get(Applicant, number):
                    continue
                session.add(Applicant(number=number, surname=surname, first_name=name,
                                      profile={"Телефон": f"+700000000{index:02}", "Почта": f"demo{index}@example.invalid",
                                               "Тип документа ОУ": "Аттестат об основном общем образовании"}))
                session.flush()
                group = {"year": 2026, "campaign": "СПО", "direction": DIRECTIONS[direction],
                         "study_form": "Очная", "quota": quota}
                app = Application(**group, applicant_number=number, consent=True, total_score=grade,
                                  source={"Средний балл аттестата": str(grade / 100),
                                          "Дата получения документов": moscow_today().isoformat()})
                session.add(app)
                if not session.scalar(select(SeatPlan.id).filter_by(**group)):
                    session.add(SeatPlan(**group, seats=2))
                if quota == "paid" and index in {4, 5}:
                    session.flush()
                    contract = create_contract(session, app.id, f"ПК-2026-{index:04}", LOGIN)
                    for stage in ("issued", "signed", "registered"):
                        update_contract(session, contract, LOGIN, stage=stage)
                    if index == 4:
                        update_contract(session, contract, LOGIN, paid=True)
    finally:
        db.engine.dispose()
