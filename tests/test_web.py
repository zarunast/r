from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
import pytest

from admissions.api import create_app
from admissions.models import Applicant, Application
from admissions.security import add_user


@pytest.fixture
def web(tmp_path):
    app = create_app(f"sqlite:///{tmp_path}/web.sqlite3", jwt_secret="web-test-key-" * 8)
    with TestClient(app, client=("127.0.0.1", 12345)) as client:
        with app.state.db.uow() as s:
            add_user(s, "operator", "web-test-password")
            s.add(Applicant(number="001", surname="Тестов", first_name="Иван", profile={"Телефон": "+70000000000"}))
            s.flush()
            today = datetime.now(ZoneInfo("Europe/Moscow")).strftime("%d.%m.%Y")
            s.add(Application(applicant_number="001", year=2026, campaign="бак", direction="ИТ",
                              study_form="Очная", quota="general", total_score=250, consent=True,
                              source={"Дата получения документов": today + " 12:00:00"}))
        token = client.post("/auth/token", data={"username": "operator", "password": "web-test-password"}).json()["access_token"]
        yield client, {"Authorization": f"Bearer {token}"}


def test_internal_views_require_authentication(web):
    client, _ = web
    for path in ["/auth/me", "/dashboard?year=2026", "/activities", "/catalog/groups?year=2026", "/registry?year=2026", "/contracts?year=2026",
                 "/rankings?year=2026&direction=ИТ&campaign=бак&study_form=Очная"]:
        assert client.get(path).status_code == 401


def test_dashboard_and_registry_filters(web):
    client, headers = web
    assert client.get("/auth/me", headers=headers).json()["login"] == "operator"
    response = client.get("/dashboard?year=2026", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["applicants"] == data["applications_today"] == 1
    assert data["paid_contracts"] == data["overcrowded"] == 0
    assert client.get("/dashboard?year=2025", headers=headers).json()["applicants"] == 0
    result = client.get("/registry", params={"year": 2026, "q": "тестов иван", "quota": "general"}, headers=headers).json()
    assert result["total"] == 1 and result["items"][0]["best_score"] == 250
    assert client.get("/registry?year=2026&quota=paid", headers=headers).json()["total"] == 0
    assert client.get("/registry", params={"year": 2026, "q": "' OR 1=1 --"}, headers=headers).json()["total"] == 0


def test_internal_rankings_and_plans(web):
    client, headers = web
    group = {"year": 2026, "direction": "ИТ", "campaign": "бак", "study_form": "Очная"}
    assert client.put("/seat-plans", headers=headers, json={**group, "quota": "general", "seats": 10}).status_code == 200
    response = client.get("/rankings", params=group, headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["lists"]) == 5 and data["seats"]["general"] == 10
    assert data["lists"]["general"][0]["full_name"] == "Тестов Иван"
    assert data["lists"]["general"][0]["consent"] is True
    public = client.get("/public/rankings", params=group).json()
    assert "Тестов" not in str(public) and "full_name" not in str(public)
    events = client.get("/activities", headers=headers).json()
    assert events["total"] == 1 and events["items"][0]["actor"] == "operator"
    assert events["items"][0]["at"].endswith("+00:00") or events["items"][0]["at"].endswith("Z")


def test_atomic_registration_and_activity(web):
    client, headers = web
    payload = {"applicant": {"number": "002", "surname": "Новый", "first_name": "Иван"},
               "application": {"applicant_number": "002", "year": 2026, "campaign": "бак", "direction": "ИТ",
                               "study_form": "Очная", "quota": "paid", "exam_scores": {"Русский": 90}, "achievements": 5}}
    assert client.post("/registry", json=payload, headers=headers).status_code == 201
    assert client.post("/registry", json=payload, headers=headers).status_code == 409
    events = client.get("/activities", headers=headers).json()
    assert events["total"] == 1  # Ошибочная операция не записывается как успешная.
    application_id = client.get("/applicants/002", headers=headers).json()["applications"][0]["id"]
    created = client.post("/contracts", json={"application_id": application_id, "number": "D-test"}, headers=headers)
    assert created.status_code == 201
    rows = client.get("/contracts?year=2026&paid=false&q=новый", headers=headers).json()
    assert rows["total"] == 1 and rows["items"][0]["full_name"] == "Новый Иван"
    assert client.get("/contracts?year=2026&stage=registered", headers=headers).json()["total"] == 0


def test_registration_invalid_score_rolls_back_person(web):
    client, headers = web
    payload = {"applicant": {"number": "003", "surname": "Не сохранять"},
               "application": {"applicant_number": "003", "year": 2026, "campaign": "бак", "direction": "ИТ",
                               "study_form": "Очная", "quota": "general", "exam_scores": {"Русский": 101}}}
    assert client.post("/registry", json=payload, headers=headers).status_code == 400
    assert client.get("/applicants/003", headers=headers).status_code == 404
