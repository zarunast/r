from io import BytesIO
from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient

from admissions.api import create_app
from admissions.security import add_user


def test_college_workflow(tmp_path):
    app = create_app(f"sqlite:///{tmp_path}/college.sqlite3", jwt_secret="college-test-key-" * 4)
    with TestClient(app, client=("127.0.0.1", 12345)) as client:
        with app.state.db.uow() as session:
            add_user(session, "secretary", "testing-password")
        token = client.post("/auth/token", data={"username": "secretary", "password": "testing-password"}).json()["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"
        spreadsheet = Path("demo/Заявления_СПО.xlsx")
        response = client.post("/imports/epgu?year=2026", files={"file": (spreadsheet.name, spreadsheet.read_bytes())})
        assert response.json()["errors"] == []
        assert response.json()["new_applications"] == 2
        group = {"year": 2026, "campaign": "СПО", "study_form": "Очная",
                 "direction": "09.02.07 Информационные системы и программирование"}
        application = client.get("/applicants/000900021").json()["applications"][0]
        ranked = client.get("/rankings", params=group).json()["lists"]["general"]
        assert ranked[0]["score"] == 4.83
        endpoint = f"/applications/{application['id']}"
        assert client.patch(endpoint, json={"certificate_average": "5,01"}).status_code == 400
        assert client.patch(endpoint, json={"certificate_average": "4,91"}).json()["total_score"] == 491
        order = {"order_number": "ПК-01", "enrolled_at": "2026-09-01"}
        assert client.post(endpoint + "/enroll", json=order).status_code == 400
        assert client.put("/seat-plans", json={**group, "quota": "general", "seats": 1}).status_code == 200
        assert client.post(endpoint + "/enroll", json=order).json()["status"] == "enrolled"
        assert client.get("/exports/1c?year=2026").json()["students"][0]["applicant_number"] == "000900021"

        paid = client.get("/applicants/000900022").json()["applications"][0]
        contract = client.post("/contracts", json={"application_id": paid["id"], "number": "ПК-002"}).json()
        word = client.get(f"/contracts/{contract['id']}/document")
        doc = Document(BytesIO(word.content))
        assert "Федотов Кирилл" in doc.element.xml and "Дополнительное соглашение" in doc.element.xml
        assert "{{" not in doc.element.xml

        manual = {**group, "certificate_average": "4.72", "applicant_number": "000900023"}
        assert client.post("/registry", json={
            "applicant": {"number": "000900023", "surname": "Волкова", "first_name": "Анна"},
            "application": manual,
        }).status_code == 201
