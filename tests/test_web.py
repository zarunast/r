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


def test_admission_content_publication_and_pdf_replacement(web):
    client, headers = web
    public = "/public/admission"
    private = "/admission-content"
    page_path = "/pages/bachelor"
    initial = client.get(public + page_path).json()
    assert initial["page"]["revision"] == 0
    assert {"master-seats", "master-exams"} <= initial["documents"].keys()
    for document in initial["available_documents"]:
        download = client.get(f"{public}/documents/{document}")
        assert download.status_code == 200
        assert download.headers["content-type"] == "application/pdf"
        assert download.headers["content-disposition"].startswith("attachment;")
        assert download.content.startswith(b"%PDF-")

    draft = initial["page"]
    draft["blocks"][0]["text"] = "Изменённое описание мест приёма"
    assert client.put(private + page_path, json=draft).status_code == 401
    updated = client.put(private + page_path, headers=headers, json=draft)
    assert updated.status_code == 200
    assert updated.json()["revision"] == 1
    assert client.get(public + page_path).json()["page"] == updated.json()
    assert client.put(private + page_path, headers=headers, json=draft).status_code == 409
    second_draft = {**updated.json(), "title": "Обновлённая страница"}
    assert client.put(private + page_path, headers=headers, json=second_draft).json()["revision"] == 2

    document_path = "/documents/dates"
    original = client.get(public + document_path).content
    replacement = client.get(public + "/documents/tuition").content
    upload = {"file": ("new.pdf", replacement, "application/pdf")}
    assert client.put(private + document_path, files=upload).status_code == 401
    assert client.put(private + document_path, headers=headers, files={"file": ("broken.pdf", b"broken")}).status_code == 422
    assert client.get(public + document_path).content == original
    assert client.put(private + document_path, headers=headers, files=upload).status_code == 200
    assert client.get(public + document_path).content == replacement
    assert client.get(public + "/documents/unknown").status_code == 404


@pytest.mark.parametrize(("key", "columns"), [("undergraduate-tests", 7), ("graduate-tests", 9), ("commission-contacts", 2)])
def test_portal_tables_support_row_edits(web, key, columns):
    client, headers = web
    path = f"/pages/{key}"
    public = "/public/admission" + path
    draft = client.get(public).json()["page"]
    table = next(block for block in draft["blocks"] if len(block["columns"]) == columns)
    row = ["Проверка"] * columns
    table["rows"].pop(0)
    table["rows"].append(row)
    response = client.put("/admission-content" + path, headers=headers, json=draft)
    assert response.status_code == 200, response.text
    assert client.get(public).json()["page"]["blocks"] == draft["blocks"]


def test_enrollment_orders_can_be_published_when_source_pdf_is_missing(web):
    client, headers = web
    page = "/public/admission/pages/orders"
    data = client.get(page).json()
    keys = {key for block in data["page"]["blocks"] for key in block["documents"]}
    assert len(keys) == 14
    assert keys.intersection(data["available_documents"]) == {
        "order-972-3", "order-973-3", "order-974-3", "order-975-3"
    }
    key = "order-971-3"
    public = f"/public/admission/documents/{key}"
    private = f"/admission-content/documents/{key}"
    assert client.get(public).status_code == 404
    pdf = client.get("/public/admission/documents/order-972-3").content
    upload = {"file": ("test.pdf", pdf, "application/pdf")}
    assert client.put(private, files=upload).status_code == 401
    assert client.put(private, files=upload, headers=headers).status_code == 200
    assert key in client.get(page).json()["available_documents"]
    assert client.get(public).content == pdf


def test_admission_media_publication_and_removal(web):
    client, headers = web
    upload = "/admission-content/pages/council/media"
    page = "/public/admission/pages/council"
    video = b"\x00\x00\x00\x10ftypisom\x00\x00\x00\x00"
    form = {"data": {"caption": "Заседание совета"}, "files": {"file": ("council.mp4", video)}}

    assert client.post(upload, **form).status_code == 401
    assert client.post(upload, headers=headers, data=form["data"],
                       files={"file": ("photo.png", b"<html>")}).status_code == 422
    published = client.post(upload, headers=headers, **form)
    assert published.status_code == 201
    item = published.json()
    assert item["mime_type"] == "video/mp4"
    assert client.get(page).json()["media"] == [item]
    assert client.get("/public/admission/pages/activities").json()["media"] == []

    public_url = "/public/admission/media/" + item["key"]
    response = client.get(public_url)
    assert response.content == video
    assert response.headers["content-type"] == "video/mp4"
    partial = client.get(public_url, headers={"Range": "bytes=4-7"})
    assert partial.status_code == 206
    assert partial.content == b"ftyp"
    assert partial.headers["content-range"] == "bytes 4-7/16"
    assert client.get(public_url, headers={"Range": "bytes=16-"}).status_code == 416

    delete_url = upload + "/" + item["key"]
    assert client.delete(delete_url).status_code == 401
    assert client.delete(delete_url.replace("/council/", "/activities/"), headers=headers).status_code == 404
    assert client.delete(delete_url, headers=headers).status_code == 200
    assert client.get(public_url).status_code == 404
    assert client.get(page).json()["media"] == []


def test_editor_and_examiner_are_isolated(web):
    client, operator = web
    with client.app.state.db.uow() as db:
        add_user(db, "editor", "test-editor-password", "editor")
        add_user(db, "examiner", "test-examiner-password", "examiner")

    def login(role):
        credentials = {"username": role, "password": f"test-{role}-password"}
        other_role = "examiner" if role == "editor" else "editor"
        common_login = client.post("/auth/token", data=credentials)
        assert common_login.status_code == 200
        common_headers = {"Authorization": "Bearer " + common_login.json()["access_token"]}
        assert client.get("/auth/me", headers=common_headers).json()["role_id"] == role
        assert client.post(f"/auth/token/{other_role}", data=credentials).status_code == 401
        response = client.post(f"/auth/token/{role}", data=credentials)
        assert response.status_code == 200
        headers = {"Authorization": "Bearer " + response.json()["access_token"]}
        assert client.get("/auth/me", headers=headers).json()["role_id"] == role
        return headers

    editor, examiner = login("editor"), login("examiner")
    assert client.get("/dashboard?year=2026", headers=editor).status_code == 403
    assert client.get("/registry?year=2026", headers=examiner).status_code == 403
    assert client.get("/admission-content/pages", headers=editor).status_code == 200
    assert client.get("/admission-content/pages", headers=examiner).status_code == 403
    assert client.get("/exam-review/applicants?q=Тестов", headers=editor).status_code == 403
    assert client.get("/exam-review/applicants?q=Тестов", headers=operator).status_code == 403

    page = client.get("/public/admission/pages/alumni").json()["page"]
    page["title"] = "Истории выпускников"
    assert client.put("/admission-content/pages/alumni", json=page, headers=examiner).status_code == 403
    assert client.put("/admission-content/pages/alumni", json=page, headers=editor).status_code == 200
    assert client.get("/public/admission/pages/alumni").json()["page"]["title"] == page["title"]

    search = client.get("/exam-review/applicants", params={"q": "иВАН тестов"}, headers=examiner)
    assert search.json() == [{"number": "001", "name": "Тестов Иван"}]
    detail = client.get("/exam-review/applicants/001", headers=examiner).json()
    assert "Телефон" not in str(detail)
    application = detail["applications"][0]
    path = f"/exam-review/applications/{application['id']}/scores"
    body = {"exam_scores": {"Математика": 85}, "previous_scores": {}, "previous_total": 250}
    assert client.put(path, json=body, headers=editor).status_code == 403
    assert client.put(path, json={**body, "exam_scores": {"Математика": 101}}, headers=examiner).status_code == 400
    assert client.put(path, json=body, headers=examiner).json() == {"total_score": 85, "exams": {"Математика": 85}}
    assert client.put(path, json=body, headers=examiner).status_code == 409
    assert client.patch(f"/applications/{application['id']}", json={"consent": False}, headers=examiner).status_code == 403
    assert client.get("/applicants/001", headers=operator).json()["applications"][0]["total_score"] == 85


def test_public_assistant_uses_published_content_only(tmp_path, monkeypatch):
    import httpx
    from admissions.admission_content import AdmissionPage

    monkeypatch.setenv("OPENAI_API_KEY", "test-assistant-key")
    request_body = {}

    def answer(url, **kwargs):
        assert url == "https://api.openai.com/v1/responses"
        request_body.update(kwargs["json"])
        return httpx.Response(200, request=httpx.Request("POST", url), json={
            "output": [{"type": "message", "content": [{"type": "output_text", "text": "Сведения об общежитии."}]}],
        })

    monkeypatch.setattr("admissions.assistant.httpx.post", answer)
    app = create_app(f"sqlite:///{tmp_path}/assistant.sqlite3", jwt_secret="assistant-test-secret-" * 4)
    with TestClient(app, client=("203.0.113.25", 12345)) as client:
        with app.state.db.uow() as db:
            db.add(Applicant(number="private", surname="СекретФамилия"))
            db.add(AdmissionPage(key="housing", revision=1, content={
                "title": "Общежитие БГТУ",
                "blocks": [{"heading": "Общежитие", "text": "Публичная информация о заселении.",
                            "columns": [], "rows": [], "documents": []}],
            }))
        assert client.get("/").status_code in {403, 404}
        assert client.get("/abiturient/workspace/").status_code in {200, 404}
        result = client.post("/public/assistant", json={"question": "Где общежитие БГТУ?"})
        assert result.status_code == 200
        assert result.json()["answer"] == "Сведения об общежитии."
        assert any(source["href"].endswith("/housing") for source in result.json()["sources"])
        assert "Публичная информация о заселении." in request_body["input"]
        assert "СекретФамилия" not in request_body["input"]
        assert request_body["store"] is False


def test_dashboard_works_without_iana_timezones(web, monkeypatch):
    from zoneinfo import ZoneInfoNotFoundError

    def unavailable(_key):
        raise ZoneInfoNotFoundError("Europe/Moscow")

    monkeypatch.setattr("admissions.services.ZoneInfo", unavailable)
    client, auth = web
    response = client.get("/dashboard?year=2026", headers=auth)
    assert response.status_code == 200
    assert response.json()["applicants"] == 1
    assert response.json()["applications_today"] == 1


def test_workbook_draft_and_contract_payment(web):
    import io
    from docx import Document
    from openpyxl import load_workbook
    from sqlalchemy import select

    client, auth = web
    with client.app.state.db.uow() as db:
        budget = db.scalar(select(Application))
        budget_id = budget.id
        paid = Application(applicant_number="001", year=2026, campaign="бак",
                           direction="Физика", study_form="Очная", quota="paid", total_score=251)
        db.add(paid)
        db.flush()
        paid_id = paid.id
    workbook = client.get("/reports/ranking-workbook?year=2026", headers=auth)
    assert workbook.status_code == 200
    excel = load_workbook(io.BytesIO(workbook.content), read_only=True)
    try:
        assert len(excel.sheetnames) == 5
        assert list(excel["Основной конкурс"].values)[1][:4] == ("ИТ", "бак", "Очная", 1)
        assert list(excel["Платное обучение"].values)[1][0] == "Физика"
        assert len(list(excel["Особая квота"].values)) == 1
    finally:
        excel.close()

    group = {"year": 2026, "direction": "ИТ", "campaign": "бак", "study_form": "Очная", "quota": "general"}
    payload = dict(group, application_ids=[budget_id], order_number="883-3",
                   order_date="2026-08-03", enrolled_at="2026-09-01")
    assert client.post("/reports/enrollment-draft", headers=auth, json=payload).status_code == 400
    assert client.put("/seat-plans", headers=auth, json=dict(group, seats=1)).status_code == 200
    draft = client.post("/reports/enrollment-draft", headers=auth, json=payload)
    assert draft.status_code == 200
    doc = Document(io.BytesIO(draft.content))
    assert any("ПРОЕКТ ПРИКАЗА" in paragraph.text for paragraph in doc.paragraphs)
    assert doc.tables[0].rows[1].cells[1].text == "001"
    assert client.get("/applicants/001", headers=auth).json()["applications"][0]["status"] == "participating"

    contract = client.post("/contracts", headers=auth, json={"application_id": paid_id, "number": "Д-1"}).json()
    assert client.patch(f"/contracts/{contract['id']}", headers=auth, json={"paid": True}).json()["paid"]
    history = client.get(f"/contracts/{contract['id']}/history", headers=auth).json()
    assert history[-1]["changes"]["paid"] == {"from": False, "to": True}
    assert client.get("/public/admission/documents/tuition-contract-sample").content.startswith(b"%PDF-")
    assert client.get("/public/admission/documents/tuition-contract-addendum").content.startswith(b"%PDF-")

    reference = client.get("/reports/bachelor-seat-reference", headers=auth).json()
    assert len(reference) == 58
    assert sum(row["seats"]["general"] for row in reference if row["study_form"] == "Очная") == 648


def test_complete_contract_validates_and_fills_both_forms(web):
    import io
    from docx import Document

    client, auth = web
    with client.app.state.db.uow() as db:
        app = Application(applicant_number="001", year=2026, campaign="бак",
                          direction="ИТ", study_form="Очная", quota="paid", total_score=250)
        db.add(app)
        db.flush()
        app_id = app.id
    response = client.post("/contracts", headers=auth, json={"application_id": app_id, "number": "ТЕСТ-01"})
    assert response.status_code == 201
    prefix = f"/contracts/{response.json()['id']}"
    fields = client.get(prefix + "/document-fields", headers=auth).json()
    assert next(field for field in fields if field["key"] == "full_name")["value"] == "Тестов Иван"
    assert client.post(prefix + "/complete-document", headers=auth, json={}).status_code == 400
    values = {field["key"]: field["value"] or "Тестовое значение" for field in fields}
    filled = client.post(prefix + "/complete-document", headers=auth, json=values)
    assert filled.status_code == 200
    doc = Document(io.BytesIO(filled.content))
    body = "\n".join(p.text for p in doc.paragraphs)
    assert "ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ" in body and body.count("ТЕСТ-01") >= 2
    assert "{{" not in body and len(doc.tables) == 2
    assert all("Подпись __________________" in cell.text for t in doc.tables for cell in t.rows[1].cells[1:])


def test_contract_suggests_year_tariff_and_faculty_by_profile(web):
    from admissions.contract_fields import tuition_defaults

    client, auth = web
    with client.app.state.db.uow() as db:
        app = Application(
            applicant_number="001", year=2026, campaign="бак",
            direction="ПИ(КПД)_заоч_плат", study_form="Заочная", quota="paid",
            source={
                "НПС/УГСН": "1.09.03.03 Прикладная информатика",
                "Обр.программа": "Компьютерное проектирование и дизайн",
                "Адрес регистрации": "Учебный адрес из выгрузки",
            },
        )
        db.add(app)
        db.flush()
        app_id = app.id
        assert tuition_defaults(app)["faculty"] == "Учебно-научный институт транспорта"
        different_profile = Application(year=2026, study_form="Заочная", direction="09.03.03",
                                        source={"Обр.программа": "Информационные технологии в цифровой экономике"})
        assert tuition_defaults(different_profile)["faculty"] == "Факультет отраслевой и цифровой экономики"
        ambiguous = Application(year=2026, study_form="Заочная", direction="09.03.03", source={})
        assert tuition_defaults(ambiguous) == {}
        master_part_time = Application(year=2026, study_form="Очно-заочная", direction="10.04.01", source={})
        assert tuition_defaults(master_part_time) == {"faculty": "Факультет информационных технологий"}

    response = client.post("/contracts", headers=auth, json={"application_id": app_id, "number": "ТЕСТ-ТАРИФ"})
    fields = client.get(f"/contracts/{response.json()['id']}/document-fields", headers=auth).json()
    values = {f["key"]: f["value"] for f in fields}
    assert values["full_name"] == "Тестов Иван"
    assert values["student_phone"] == "+70000000000"
    assert values["student_address"] == "Учебный адрес из выгрузки"
    assert values["year_cost"].startswith("70 550,00")
    assert not values["total_cost"] and not values["semester_cost"]
