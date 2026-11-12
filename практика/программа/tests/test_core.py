from datetime import date
import io
import json
import sqlite3

from docx import Document
from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook
import pytest
from sqlalchemy import select

from admissions.api import create_app
from admissions.db import Database
from admissions.importer import import_epgu
from admissions.models import Applicant, Application, Contract, ContractEvent, Quota, SeatPlan
from admissions.security import add_user
from admissions import services as svc


HEADERS = ["Идентификатор", "Направление", "Приемная кампания", "Форма обучения", "Категория",
           "Сумма баллов", "Общие ИД", "Русский язык", "Математика", "Физика", "Информатика",
           "Фамилия", "Имя", "Телефон", "СНИЛС", "Приоритет", "Согласие", "Статус"]


def excel(path, rows, headers=HEADERS):
    w = Workbook()
    w.active.append(headers)
    for row in rows:
        w.active.append(row)
    w.save(path)
    return path


def row(number="00123", direction="ИТ", category="бюдж", score=240):
    return [number, direction, "бак", "Очная", category, score, 10, "80", "80", "70", "90",
            "Тестовый", "Абитуриент", "+70000000000", "00000000000", 1, "ДА", "Участвует в конкурсе"]


@pytest.fixture
def db(tmp_path):
    instance = Database(f"sqlite:///{tmp_path}/test.sqlite3")
    instance.create_schema()
    yield instance
    instance.engine.dispose()


def test_import_multiple_applications_and_repeat(db, tmp_path):
    path = excel(tmp_path / "epgu.xlsx", [row(), row(direction="Физика"), row(category="плат")])
    first = import_epgu(db, path, 2026)
    second = import_epgu(db, path, 2026)
    assert first.new_applicants == 1 and first.new_applications == 3 and not first.errors
    assert second.new_applicants == second.updated_applicants == second.updated_applications == 0
    assert second.unchanged_applications == 3
    with db.uow() as s:
        apps = s.scalars(select(Application)).all()
        assert len(apps) == 3 and apps[0].total_score == 240  # Не 330 из альтернативных экзаменов.
        assert s.get(Applicant, "00123") is not None
    changed = row(score=250)
    excel(path, [changed])
    assert import_epgu(db, path, 2026).updated_applications == 1
    assert import_epgu(db, path, 2027).new_applications == 1


def test_import_errors_and_semantic_headers(db, tmp_path):
    bad = row("003")
    bad[5] = "не балл"
    headers = HEADERS.copy()
    headers[0] = " Номер абитуриента "
    headers[5] = "Итоговый балл"
    path = excel(tmp_path / "epgu.xlsx", [row(), bad, row(), row(123)], headers)
    report = import_epgu(db, path, 2026)
    assert report.new_applications == 1 and len(report.errors) == 3
    assert {e["row"] for e in report.errors} == {3, 4, 5}
    assert all("Тестовый" not in str(e) for e in report.errors)


def test_unknown_quota_not_assumed_general(db, tmp_path):
    report = import_epgu(db, excel(tmp_path / "q.xlsx", [row(category="неизвестно")]), 2026)
    assert len(report.errors) == 1 and report.new_applications == 0


@pytest.mark.parametrize("category,expected", [
    ("Особая квота", "special"), ("Отдельная квота", "separate"),
    ("Целевое направление", "target"), ("бюдж", "general"), ("плат", "paid"),
])
def test_five_categories(db, tmp_path, category, expected):
    import_epgu(db, excel(tmp_path / "quota.xlsx", [row(category=category)]), 2026)
    with db.uow() as s:
        obj = s.scalar(select(Application))
        assert obj.quota == expected and obj.total_score == 240


def test_conflicting_profiles_stable_and_local_fields_preserved(db, tmp_path):
    first = row()
    last = row(direction="Физика")
    last[13] = "+71111111111"
    path = excel(tmp_path / "conflict.xlsx", [first, last])
    import_epgu(db, path, 2026)
    with db.uow() as s:
        person = s.get(Applicant, "00123")
        person.profile = {**person.profile, "parent": {"name": "Родитель"}}
    report = import_epgu(db, path, 2026)
    assert report.updated_applicants == 0 and any("персональные поля" in w for w in report.warnings)
    with db.uow() as s:
        person = s.get(Applicant, "00123")
        assert person.profile["Телефон"] == "+71111111111" and person.profile["parent"]["name"] == "Родитель"


def test_rankings_ties_and_forecast(db, tmp_path):
    import_epgu(db, excel(tmp_path / "epgu.xlsx", [row("001"), row("002"), row("003", score=200), row("004", category="плат")]), 2026)
    with db.uow() as s:
        groups = svc.all_rankings(s, 2026, "ИТ", "бак", "Очная")
        assert len(groups) == 5
        assert [r["rank"] for r in groups["general"]] == [1, 1, 3]
        assert set(groups["general"][0]) == {"applicant_number", "score", "quota", "direction", "rank"}
        s.add(SeatPlan(year=2026, campaign="бак", direction="ИТ", study_form="Очная", quota="general", seats=1))
        s.flush()
        a = s.scalar(select(Application).where(Application.applicant_number == "001"))
        assert svc.forecast(s, a)["assessment"] == "tie_at_boundary"


def test_contract_payments_document_and_history(db, tmp_path):
    import_epgu(db, excel(tmp_path / "epgu.xlsx", [row(category="плат")]), 2026)
    with db.uow() as s:
        a = s.scalar(select(Application))
        c = svc.create_contract(s, a.id, "2026/1", "secretary")
        with pytest.raises(ValueError):
            svc.update_contract(s, c, "secretary", stage="registered")
        svc.update_contract(s, c, "secretary", stage="issued", location="applicant")
        svc.update_contract(s, c, "secretary", stage="signed")
        svc.update_contract(s, c, "secretary", stage="registered")
        payment = excel(tmp_path / "payments.xlsx", [["2026/1", "ДА"], ["missing", "ДА"]], ["Номер договора", "Оплачен"])
        result = svc.reconcile_payments(s, payment, "accountant")
        assert result["confirmed"] == 1 and len(result["errors"]) == 1 and c.paid
        assert svc.reconcile_payments(s, payment, "accountant")["confirmed"] == 0
        template = Document()
        p = template.add_paragraph()
        p.add_run("Договор {{contract_")
        p.add_run("number}}: {{full_name}}")
        template.save(tmp_path / "template.docx")
        content = svc.render_contract(s, c, tmp_path / "template.docx")
        assert "2026/1" in Document(io.BytesIO(content)).paragraphs[0].text
        s.flush()
        events = s.scalars(select(ContractEvent)).all()
        assert len(events) == 5


def test_call_deadlines_and_backup(db, tmp_path):
    import_epgu(db, excel(tmp_path / "epgu.xlsx", [row(category="плат")]), 2026)
    with db.uow() as s:
        queue = svc.call_queue(s, 2026, date(2026, 8, 10), date(2026, 8, 20), date(2026, 8, 4))
        assert len(queue) == 1 and queue[0]["priority_score"] == 65
        assert svc.call_queue(s, 2026, date(2026, 8, 10), date(2026, 8, 20), date(2026, 9, 1)) == []
    destination = tmp_path / "backup.sqlite3"
    svc.backup_database(db, destination)
    with sqlite3.connect(destination) as restored:
        assert restored.execute("select count(*) from applications").fetchone()[0] == 1


def test_excel_formula_escape_and_pdf():
    data = svc.xlsx_bytes([{"name": "=1+2", "number": "00123"}])
    wb = load_workbook(io.BytesIO(data))
    assert wb.active["A2"].data_type == "s" and wb.active["A2"].value == "'=1+2"
    assert wb.active["B2"].value == "00123"
    assert svc.pdf_bytes([{"rank": 1, "applicant_number": "00123", "score": 240, "quota": "general"}]).startswith(b"%PDF")


@pytest.fixture
def client(tmp_path):
    app = create_app(f"sqlite:///{tmp_path}/api.sqlite3", jwt_secret="test-key-" * 8)
    with TestClient(app, client=("127.0.0.1", 12345)) as c:
        with app.state.db.uow() as s:
            add_user(s, "secretary", "test-password-123")
        yield c


def auth(client):
    result = client.post("/auth/token", data={"username": "secretary", "password": "test-password-123"})
    assert result.status_code == 200
    return {"Authorization": "Bearer " + result.json()["access_token"]}


def test_api_auth_public_privacy_enrollment_and_exports(client, tmp_path):
    assert client.get("/applicants").status_code == 401
    assert client.post("/auth/token", data={"username": "secretary", "password": "wrong"}).status_code == 401
    headers = auth(client)
    path = excel(tmp_path / "epgu.xlsx", [row()])
    with path.open("rb") as stream:
        response = client.post("/imports/epgu?year=2026", files={"file": ("epgu.xlsx", stream)}, headers=headers)
    assert response.status_code == 200, response.text
    private = client.get("/applicants/00123", headers=headers).json()
    assert len(client.get("/applicants", params={"q": "тестовый"}, headers=headers).json()) == 1
    application_id = private["applications"][0]["id"]
    public = client.get("/public/applicants/00123?year=2026")
    assert public.status_code == 200
    for secret in ["Тестовый", "+70000000000", "00000000000", "profile", "source", "surname"]:
        assert secret not in public.text
    assert client.get("/applicants", params={"q": "' OR 1=1 --"}, headers=headers).json() == []
    response = client.post(f"/applications/{application_id}/enroll", json={"order_number": "42", "enrolled_at": "2026-08-10"}, headers=headers)
    assert response.status_code == 200, response.text
    exported = client.get("/exports/1c?year=2026", headers=headers).json()
    assert exported["students"][0]["applicant_number"] == "00123"
    with path.open("rb") as stream:
        repeated = client.post("/imports/epgu?year=2026", files={"file": ("epgu.xlsx", stream)}, headers=headers)
    assert repeated.status_code == 200 and repeated.json()["unchanged_applications"] == 1
    assert client.get("/applicants/00123", headers=headers).json()["applications"][0]["source"]["enrollment_order"] == "42"
    assert client.get("/exports/1c?year=2026&format=xml", headers=headers).content.startswith(b"<?xml")
    stats = client.get("/reports/statistics?year=2026", headers=headers)
    assert stats.status_code == 200 and stats.json()["statuses"] == {"enrolled": 1}


def test_uow_rollback(db):
    with pytest.raises(RuntimeError):
        with db.uow() as s:
            s.add(Applicant(number="001"))
            s.flush()
            raise RuntimeError("rollback")
    with db.uow() as s:
        assert s.get(Applicant, "001") is None


def test_lan_guard(tmp_path):
    app = create_app(f"sqlite:///{tmp_path}/lan.sqlite3", jwt_secret="test-key-" * 8)
    with TestClient(app, client=("203.0.113.10", 12345)) as client:
        assert client.post("/auth/token", data={"username": "x", "password": "x"}).status_code == 403
        assert client.get("/health").status_code == 200
