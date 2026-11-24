from datetime import date
from io import BytesIO
from zipfile import ZipFile

from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy import select

from admissions.api import create_app
from admissions.models import Application
from admissions.presentation import PASSWORD, seed_presentation


def test_presentation_order_calls_and_contract_batch(tmp_path):
    url = f"sqlite:///{tmp_path}/presentation.sqlite3"
    seed_presentation(url)
    seed_presentation(url)
    app = create_app(url, jwt_secret="presentation-test-" * 4)
    with TestClient(app, client=("127.0.0.1", 12345)) as client:
        token = client.post("/auth/token", data={"username": "demo-secretary", "password": PASSWORD}).json()
        auth = {"Authorization": f"Bearer {token['access_token']}"}
        dashboard = client.get("/dashboard?year=2026", headers=auth).json()
        assert (dashboard["paid_contracts"], dashboard["overcrowded"]) == (2, 2)
        today = date.fromisoformat(dashboard["date"])
        dates = {"year": 2026, "change_deadline": today, "payment_deadline": today}
        calls = client.get("/calls/queue", headers=auth, params=dates).json()
        assert len(calls) == 6
        assert all(call["phone"] for call in calls)
        with app.state.db.uow() as session:
            applications = {item.applicant_number: item for item in session.scalars(select(Application))}
        paid = applications["99000000001"]
        assert paid.applicant_number not in {call["applicant_number"] for call in calls}
        group = {name: getattr(paid, name) for name in ("year", "campaign", "direction", "study_form", "quota")}
        order = client.post("/reports/enrollment-draft", headers=auth, json={
            **group, "application_ids": [paid.id], "order_number": "ДЕМО-01",
            "order_date": today.isoformat(), "enrolled_at": today.isoformat(),
        })
        assert order.status_code == 200
        assert Document(BytesIO(order.content)).tables[0].rows[1].cells[1].text == paid.applicant_number

        token = client.post("/auth/token", data={"username": "demo-teacher", "password": PASSWORD}).json()
        examiner = {"Authorization": f"Bearer {token['access_token']}"}
        gradebook = client.get("/exam-review/gradebook", headers=examiner, params={"year": 2026, "q": "НОВИКОВА"})
        assert gradebook.status_code == 200
        row, = gradebook.json()["rows"]
        assert ["Информатика", "Прикладная информатика"] in row["subjects"]
        result = client.put(f"/exam-review/applications/{paid.id}/scores", headers=examiner, json={
            "exam_scores": {"Информатика": 100, "Физика": 97},
            "previous_scores": row["exams"], "previous_total": row["total_score"],
        })
        assert result.status_code == 200
        assert result.json()["total_score"] == 100 + row["exams"]["Математика"] + row["exams"]["Русский язык"] + row["achievements"]

        ids = [applications["99000000009"].id, applications["99000000010"].id]
        rejected = client.post("/contracts/batch", headers=auth, json={"year": 2026, "application_ids": [ids[0], paid.id]})
        assert rejected.status_code == 400
        assert client.get("/contracts?year=2026", headers=auth).json()["total"] == 6
        result = client.post("/contracts/batch", headers=auth, json={"year": 2026, "application_ids": ids})
        assert result.status_code == 201
        with ZipFile(BytesIO(result.content)) as archive:
            assert archive.namelist() == ["Д-2026-0009.docx", "Д-2026-0010.docx"]
            doc = Document(BytesIO(archive.read(archive.namelist()[0])))
            assert "Иванова Полина Романовна" in doc.element.xml
            assert "{{" not in doc.element.xml
