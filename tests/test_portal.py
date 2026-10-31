import json

from fastapi.testclient import TestClient
import pytest

from admissions.api import create_app
from admissions.models import Applicant, Application, SeatPlan


@pytest.fixture
def portal(tmp_path):
    app = create_app(f"sqlite:///{tmp_path}/portal.sqlite3", jwt_secret="public-portal-test-" * 4)
    with TestClient(app, client=("203.0.113.42", 9876)) as client:
        with app.state.db.uow() as s:
            for i in range(5):
                s.add(Applicant(number=f"00123456{i+7}", surname="СекретнаяФамилия", first_name="ЗакрытоеИмя",
                                profile={"Телефон": "+79999998888", "СНИЛС": "11122233344", "Номер": "123456"}))
            s.flush()
            for i in range(5):
                s.add(Application(applicant_number=f"00123456{i+7}", year=2026, direction="ИТ", campaign="бак",
                                  study_form="Очная", quota="general", total_score=260 if i == 0 else 250,
                                  status="pending" if i == 3 else "withdrawn" if i == 4 else "participating",
                                  source={"Обр.программа": "Программная инженерия", "НПС/УГСН": "1.09.03.04 Программная инженерия",
                                          "Фамилия": "СекретнаяФамилия", "СНИЛС": "11122233344", "Паспорт": "123456"}))
            s.add(SeatPlan(year=2026, direction="ИТ", campaign="бак", study_form="Очная", quota="general", seats=2))
            s.add(SeatPlan(year=2027, direction="Новая программа", campaign="маг", study_form="Заочная", quota="paid", seats=0))
        yield client


def test_public_catalog_without_login_and_without_private_fields(portal):
    response = portal.get("/public/catalog?year=2026")
    assert response.status_code == 200
    data = response.json()
    assert data["years"] == [2027, 2026]
    group = data["groups"][0]
    assert group["title"] == "Программная инженерия" and group["code"] == "09.03.04"
    assert group["applications"]["general"] == 3  # Pending и withdrawn не входят в конкурс.
    assert group["seats"]["general"] == 2 and group["seats"]["special"] is None
    assert group["categories"] == ["general"]
    assert set(group["applications"]) == {"general", "special", "separate", "target", "paid"}
    text = json.dumps(data, ensure_ascii=False)
    for private in ["СекретнаяФамилия", "ЗакрытоеИмя", "+79999998888", "11122233344", "123456", "profile", "source"]:
        assert private not in text


def test_public_catalog_plan_without_applications_and_empty_year(portal):
    plan_only = portal.get("/public/catalog?year=2027").json()["groups"][0]
    assert plan_only["title"] == "Новая программа"
    assert plan_only["categories"] == ["paid"]
    assert plan_only["seats"]["paid"] == 0 and sum(plan_only["applications"].values()) == 0
    assert portal.get("/public/catalog?year=2025").json()["groups"] == []
    assert portal.get("/public/catalog?year=1900").status_code == 422


def test_public_search_forecast_ties_and_leading_zeroes(portal):
    response = portal.get("/public/applicants/001234567?year=2026")
    assert response.status_code == 200
    first = response.json()[0]
    assert first["applicant_number"] == "001234567"
    assert first["forecast"]["rank"] == 1 and first["forecast"]["assessment"] == "within_seats"
    assert first["forecast"]["probability"] is None
    second = portal.get("/public/applicants/001234568?year=2026").json()[0]
    assert second["forecast"]["assessment"] == "tie_at_boundary"
    pending = portal.get("/public/applicants/0012345610?year=2026").json()[0]
    assert pending["forecast"]["rank"] is None and pending["forecast"]["assessment"] == "unknown"
    assert portal.get("/public/applicants/1234567?year=2026").status_code == 404
    for private in ["СекретнаяФамилия", "ЗакрытоеИмя", "11122233344", "profile", "source"]:
        assert private not in response.text


def test_public_lists_and_private_registry_stay_separate(portal):
    group = {"year": 2026, "direction": "ИТ", "campaign": "бак", "study_form": "Очная"}
    data = portal.get("/public/rankings", params=group).json()
    assert len(data) == 5 and [r["rank"] for r in data["general"]] == [1, 2, 2]
    assert set(data["general"][0]) == {"applicant_number", "score", "quota", "direction", "rank"}
    assert portal.get("/registry?year=2026").status_code in {401, 403}
    assert portal.get("/applicants/001234567").status_code in {401, 403}


def test_public_assistant_does_not_invent_deadlines_or_probability(portal):
    answer = portal.get("/public/faq", params={"question": "Где найти номер ЕПГУ?"}).json()["answer"]
    assert "нули" in answer or "нул" in answer
    answer = portal.get("/public/faq", params={"question": "Как оценить шансы?"}).json()["answer"]
    assert "не гарантирует" in answer and "план" in answer
    answer = portal.get("/public/faq", params={"question": "Какие сроки приёма?"}).json()["answer"]
    assert "правила" in answer and "августа" not in answer
