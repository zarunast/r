"""Публичный портал: браузерная проверка без входа и без реальных персональных данных."""
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time

import httpx
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from admissions.db import Database
from admissions.models import Applicant, Application, SeatPlan


def seed(url):
    db = Database(url)
    db.create_schema()
    with db.uow() as s:
        for number in ["001234567", "001234568", "001234569"]:
            s.add(Applicant(number=number, surname="PRIVATE_SURNAME_KEEP_SECRET", first_name="PRIVATE_GIVEN_NAME",
                            profile={"Телефон": "+79999998888", "СНИЛС": "11122233344", "Паспорт": "PRIVATE_PASSPORT"}))
        s.flush()
        for i, number in enumerate(["001234567", "001234568", "001234569"]):
            s.add(Application(applicant_number=number, year=2026, direction="Программная инженерия", campaign="бак",
                              study_form="Очная", quota="general", total_score=270-i*10, consent=True,
                              source={"Обр.программа": "Программная инженерия", "НПС/УГСН": "09.03.04 Программная инженерия",
                                      "ФИО": "PRIVATE_SURNAME_KEEP_SECRET", "СНИЛС": "11122233344"}))
        s.add(SeatPlan(year=2026, direction="Программная инженерия", campaign="бак", study_form="Очная", quota="general", seats=2))
        s.add(Application(applicant_number="001234569", year=2026, direction="ПО_плат", campaign="бак", study_form="Очная",
                          quota="paid", total_score=250, source={"Обр.программа": "Программная инженерия", "НПС/УГСН": "09.03.04 Программная инженерия"}))
        s.add(SeatPlan(year=2026, direction="ПО_плат", campaign="бак", study_form="Очная", quota="paid", seats=10))
    db.engine.dispose()


def main():
    if not (ROOT / "frontend/dist/abiturient.html").exists():
        raise RuntimeError("Сначала выполните npm run build в frontend")
    artifacts = ROOT / "artifacts"
    with tempfile.TemporaryDirectory(prefix="bgtu-public-") as directory:
        tmp = Path(directory)
        url = f"sqlite:///{tmp}/portal.sqlite3"
        seed(url)
        base = "http://127.0.0.1:18767"
        environment = {**os.environ, "DATABASE_URL": url, "JWT_SECRET": secrets.token_urlsafe(48)}
        with (tmp / "server.log").open("w+") as log:
            process = subprocess.Popen([sys.executable, "-m", "uvicorn", "admissions.api:create_app", "--factory", "--host", "127.0.0.1",
                                        "--port", "18767", "--no-proxy-headers", "--no-access-log"], cwd=ROOT, env=environment, stdout=log, stderr=log)
            try:
                with httpx.Client(trust_env=False, timeout=2) as client:
                    for _ in range(80):
                        try:
                            if client.get(base + "/health").status_code == 200:
                                break
                        except httpx.ConnectError:
                            pass
                        if process.poll() is not None:
                            raise RuntimeError("Не запустился сервер публичного портала")
                        time.sleep(.1)
                    else:
                        raise RuntimeError("Сервер не готов")
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH") or shutil.which("chromium"), args=["--no-sandbox"])
                    page = browser.new_page(viewport={"width":1440,"height":1000}, device_scale_factor=1)
                    errors = []
                    requests = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("request", lambda request: requests.append(request.url.removeprefix(base)))
                    page.goto(base + "/abiturient/", wait_until="networkidle")
                    expect(page.get_by_role("heading", name="Выбирай будущее. Поступай в БГТУ.")).to_be_visible()
                    expect(page.locator(".p-demo-bar")).to_have_count(0)
                    expect(page.locator(".p-program-card")).to_have_count(2)
                    page.locator(".p-program-card").filter(has_text="Платное обучение").get_by_role("button", name="Посмотреть конкурс").click()
                    expect(page.get_by_role("button", name="Платное обучение", pressed=True)).to_be_visible()
                    expect(page.locator(".p-rating-table tbody tr")).to_have_count(1)
                    page.get_by_role("textbox", name="Номер абитуриента ЕПГУ").fill("001234567")
                    page.get_by_role("button", name="Проверить мой номер").click()
                    expect(page.get_by_role("heading", name="Твои заявления")).to_be_visible()
                    expect(page.get_by_text("В пределах плана мест", exact=True)).to_be_visible()
                    for secret in ["PRIVATE_SURNAME_KEEP_SECRET", "PRIVATE_GIVEN_NAME", "PRIVATE_PASSPORT", "+79999998888", "11122233344"]:
                        assert secret not in page.locator("body").inner_text()
                    page.get_by_role("button", name="Как рассчитана оценка: Программная инженерия").click()
                    expect(page.get_by_role("dialog")).to_be_visible()
                    expect(page.get_by_role("dialog").get_by_text("не обученная ИИ-модель", exact=False)).to_be_visible()
                    page.keyboard.press("Escape")
                    page.get_by_role("button", name="Открыть конкурсный список", exact=True).click()
                    expect(page.locator(".p-own-row")).to_have_count(1)
                    with page.expect_download() as info:
                        page.get_by_role("button", name="Скачать CSV", exact=True).click()
                    csv = Path(info.value.path()).read_text(encoding="utf-8-sig")
                    assert "001234567" in csv and "PRIVATE_" not in csv
                    page.get_by_role("button", name="Особая квота").click()
                    expect(page.get_by_text("В этой категории пока нет участников", exact=True)).to_be_visible()
                    page.get_by_label("Кампания для поиска").select_option("2025")
                    page.get_by_role("textbox", name="Номер абитуриента ЕПГУ").fill("001234567")
                    page.get_by_role("button", name="Проверить мой номер").click()
                    expect(page.get_by_role("alert").get_by_text("Номер не найден.", exact=False)).to_be_visible()
                    page.get_by_label("Кампания для поиска").select_option("2026")
                    page.get_by_role("button", name="Открыть помощника абитуриента").click()
                    page.get_by_role("button", name="Где найти номер ЕПГУ?").click()
                    expect(page.locator(".p-chat-assistant").last.get_by_text("включая нули", exact=False)).to_be_visible()
                    page.get_by_role("textbox", name="Вопрос помощнику").fill('<img src=x onerror="alert(1)">')
                    page.get_by_role("button", name="Отправить вопрос").click()
                    expect(page.locator(".p-chat-user").last).to_contain_text("<img")
                    expect(page.locator(".p-chat-messages img")).to_have_count(0)
                    page.keyboard.press("Escape")

                    page.goto(base + "/abiturient/?demo=1", wait_until="networkidle")
                    expect(page.locator(".p-demo-bar")).to_be_visible()
                    expect(page.locator(".p-program-card")).to_have_count(6)
                    expect(page.get_by_role("textbox", name="Номер абитуриента ЕПГУ")).to_have_value("001234567")
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    page.screenshot(path=str(artifacts / "applicant-home.png"))
                    page.screenshot(path=str(artifacts / "applicant-home-full.png"), full_page=True)
                    page.get_by_role("button", name="Проверить мой номер").click()
                    expect(page.locator(".p-result-card")).to_have_count(2)
                    expect(page.get_by_text("За пределами плана мест", exact=True)).to_be_visible()
                    page.locator(".p-search-section").screenshot(path=str(artifacts / "applicant-search.png"))
                    page.get_by_role("button", name="Магистратура", exact=True).click()
                    expect(page.locator(".p-program-card")).to_have_count(1)
                    page.get_by_role("button", name="Все направления", exact=True).click()
                    page.get_by_role("textbox", name="Поиск направления").fill("09.03.04")
                    expect(page.locator(".p-program-card")).to_have_count(1)
                    page.get_by_role("textbox", name="Поиск направления").fill("")
                    page.get_by_role("button", name="Следующая страница рейтинга").click()
                    expect(page.locator(".p-rating-table tbody tr")).to_have_count(15)
                    expect(page.locator(".p-rating-table tbody tr").first.locator("td").first).to_contain_text("16")
                    page.get_by_role("button", name="Предыдущая страница рейтинга").click()
                    page.locator(".p-ratings-section").screenshot(path=str(artifacts / "applicant-rankings.png"))
                    page.get_by_role("button", name="Версия для слабовидящих").click()
                    expect(page.locator(".p-accessible")).to_have_count(1)
                    page.get_by_role("button", name="Обычная версия").click()

                    page.set_viewport_size({"width":390,"height":844})
                    page.goto(base + "/abiturient/?demo=1", wait_until="networkidle")
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    page.screenshot(path=str(artifacts / "applicant-mobile.png"))
                    page.get_by_role("button", name="Открыть меню", exact=True).click()
                    expect(page.get_by_role("navigation", name="Навигация абитуриента")).to_be_visible()
                    page.get_by_role("navigation", name="Навигация абитуриента").get_by_role("link", name="Конкурсные списки", exact=True).click()
                    expect(page.get_by_role("navigation", name="Навигация абитуриента")).to_be_hidden()
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    page.get_by_role("button", name="Открыть помощника абитуриента").click()
                    expect(page.get_by_role("dialog", name="Помощник абитуриента")).to_be_visible()
                    expect(page.get_by_role("textbox", name="Вопрос помощнику")).to_be_focused()
                    page.get_by_role("button", name="Закрыть чат").click()
                    assert not errors, errors
                    forbidden = ("/auth", "/registry", "/applicants", "/contracts", "/rankings", "/activities", "/dashboard", "/catalog")
                    assert not any(path.startswith(forbidden) for path in requests), requests
                    browser.close()
                    print("Applicant portal PASSED: anonymous real search, privacy, forecast explanation, CSV, quotas, missing year, chatbot, XSS escaping, explicit demo, program filters, pagination, accessibility and mobile; no private API calls or JavaScript errors.")
            finally:
                process.terminate()
                process.wait(timeout=10)


if __name__ == "__main__":
    main()
