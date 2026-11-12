"""Браузерные сценарии на синтетической БД. Запуск: python tests/browser_smoke.py."""
from datetime import datetime, timedelta
import io
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from zoneinfo import ZoneInfo

import httpx
from openpyxl import Workbook, load_workbook
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from admissions.db import Database
from admissions.models import Applicant, Application
from admissions.security import add_user
from admissions.services import create_contract, update_contract


def seed(url, password):
    db = Database(url)
    db.create_schema()
    with db.uow() as s:
        add_user(s, "browser-operator", password)
        for i in range(1, 5):
            s.add(Applicant(number=f"00{i}", surname=f"Тестов{i}", first_name="Иван", profile={"Почта": "test@example.com"}))
        s.flush()
        for i in range(1, 5):
            s.add(Application(applicant_number=f"00{i}", year=2026, campaign="бак", direction="Тестовая программа",
                              study_form="Очная", quota="paid" if i == 4 else "general", total_score=280 - i,
                              consent=True, priority=1))
        s.flush()
        paid = s.query(Application).filter_by(applicant_number="004").one()
        contract = create_contract(s, paid.id, "TEST-2026-1", "browser-operator")
        update_contract(s, contract, "browser-operator", stage="issued")
    db.engine.dispose()


def main():
    if not (ROOT / "frontend/dist/index.html").exists():
        raise RuntimeError("Сначала выполните cd frontend && npm ci && npm run build")
    screenshots = ROOT / "artifacts"
    screenshots.mkdir(exist_ok=True)
    password = secrets.token_urlsafe(24)
    with tempfile.TemporaryDirectory(prefix="bgtu-browser-") as folder:
        tmp = Path(folder)
        url = f"sqlite:///{tmp}/browser.sqlite3"
        seed(url, password)
        environment = {**os.environ, "DATABASE_URL": url, "JWT_SECRET": secrets.token_urlsafe(48)}
        base = "http://127.0.0.1:18766"
        with (tmp / "server.log").open("w+") as log:
            process = subprocess.Popen([sys.executable, "-m", "uvicorn", "admissions.api:create_app", "--factory",
                                        "--host", "127.0.0.1", "--port", "18766", "--no-proxy-headers", "--no-access-log"],
                                       cwd=ROOT, env=environment, stdout=log, stderr=log)
            try:
                with httpx.Client(trust_env=False, timeout=2) as client:
                    for _ in range(80):
                        try:
                            if client.get(base + "/health").status_code == 200:
                                break
                        except httpx.ConnectError:
                            pass
                        if process.poll() is not None:
                            raise RuntimeError("Тестовый сервер завершился при запуске")
                        time.sleep(.1)
                    else:
                        raise RuntimeError("Сервер не прошёл проверку готовности")
                with sync_playwright() as p:
                    executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
                    browser = p.chromium.launch(headless=True, executable_path=executable, args=["--no-sandbox"])
                    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(base, wait_until="networkidle")
                    expect(page.get_by_role("heading", name="Добро пожаловать, Анна.")).to_be_visible()
                    expect(page.locator(".metric-card")).to_have_count(4)
                    expect(page.locator(".activity-table tbody tr")).to_have_count(6)
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    page.screenshot(path=str(screenshots / "dashboard-desktop.png"), full_page=True)

                    page.get_by_role("button", name="Загрузить Excel").click()
                    expect(page.get_by_role("dialog")).to_be_visible()
                    expect(page.get_by_role("button", name="Загрузить данные")).to_be_disabled()
                    page.keyboard.press("Escape")
                    expect(page.get_by_role("dialog")).to_have_count(0)

                    page.locator("nav").get_by_role("link", name="Реестр", exact=True).click()
                    page.get_by_role("textbox", name="Поиск абитуриента").fill("Андреева")
                    expect(page.locator("tbody tr")).to_have_count(1)
                    page.locator("tbody tr").first.get_by_role("button").first.click()
                    dialog = page.get_by_role("dialog")
                    expect(dialog.get_by_role("heading", name="Карточка абитуриента")).to_be_visible()
                    dialog.get_by_role("button", name="Редактировать").click()
                    dialog.get_by_label("Телефон").fill("+70000000000")
                    dialog.get_by_role("button", name="Сохранить", exact=True).click()
                    expect(dialog.get_by_text("+70000000000", exact=True)).to_be_visible()
                    page.keyboard.press("Escape")

                    page.locator("nav").get_by_role("link", name="Рейтинги", exact=True).click()
                    expect(page.locator("tbody tr").first).to_be_visible()
                    page.get_by_role("button", name="Особая квота").click()
                    expect(page.get_by_text("В этой категории пока нет заявлений")).to_be_visible()
                    page.get_by_role("button", name="Основной конкурс").click()
                    page.get_by_role("button", name="План приёма", exact=True).click()
                    page.get_by_label("Количество мест").fill("40")
                    page.get_by_role("dialog").get_by_role("button", name="Сохранить", exact=True).click()
                    expect(page.locator(".ranking-metrics").get_by_text("40", exact=True)).to_be_visible()
                    page.screenshot(path=str(screenshots / "rankings-desktop.png"), full_page=True)

                    page.locator("nav").get_by_role("link", name="Звонки").click()
                    page.get_by_role("button", name="Результат", exact=True).first.click()
                    page.get_by_label("Как прошёл звонок?").select_option("confirmed")
                    page.get_by_label("Комментарий").fill("Тестовый результат звонка")
                    page.get_by_role("button", name="Сохранить результат").click()
                    expect(page.get_by_text("Подтвердил", exact=True).first).to_be_visible()

                    page.locator("nav").get_by_role("link", name="Отчёты", exact=True).click()
                    with page.expect_download() as info:
                        page.get_by_role("button", name="Экспорт статистики").click()
                    assert info.value.suggested_filename == "statistics-2026.csv"

                    page.set_viewport_size({"width": 390, "height": 844})
                    page.goto(base, wait_until="networkidle")
                    expect(page.locator(".metric-card")).to_have_count(4)
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    page.screenshot(path=str(screenshots / "dashboard-mobile.png"), full_page=True)
                    page.get_by_role("button", name="Открыть меню").click()
                    page.locator("nav").get_by_role("link", name="Реестр", exact=True).click()
                    expect(page.get_by_role("heading", name="Реестр абитуриентов")).to_be_visible()

                    page.set_viewport_size({"width": 1440, "height": 1000})
                    page.goto(base + "/#/login", wait_until="networkidle")
                    page.screenshot(path=str(screenshots / "login-desktop.png"), full_page=True)
                    page.get_by_label("Логин").fill("browser-operator")
                    page.get_by_label("Пароль", exact=True).fill(password)
                    page.get_by_role("button", name="Войти в систему", exact=True).click()
                    expect(page.get_by_role("heading", name="Добро пожаловать, browser-operator.")).to_be_visible()
                    expect(page.locator(".metric-card").first.get_by_text("4", exact=True)).to_be_visible()
                    expect(page.locator(".demo-label")).to_have_count(0)

                    page.locator("nav").get_by_role("link", name="Реестр", exact=True).click()
                    page.get_by_role("button", name="Добавить абитуриента").click()
                    dialog = page.get_by_role("dialog")
                    dialog.get_by_label("Номер абитуриента ЕПГУ").fill("009999999")
                    dialog.get_by_label("Фамилия", exact=True).fill("Проверочный")
                    dialog.get_by_label("Имя", exact=True).fill("Абитуриент")
                    dialog.get_by_label("Русский язык", exact=True).fill("90")
                    dialog.get_by_label("Математика", exact=True).fill("85")
                    dialog.get_by_label("По выбору", exact=True).fill("80")
                    dialog.get_by_role("button", name="Добавить абитуриента").click()
                    expect(dialog).to_have_count(0)
                    expect(page.get_by_text("Проверочный Абитуриент")).to_be_visible()

                    workbook = Workbook()
                    workbook.active.append(["Идентификатор", "Направление", "Приемная кампания", "Форма обучения", "Категория", "Сумма баллов", "Фамилия", "Имя"])
                    workbook.active.append(["005", "Тестовая программа", "бак", "Очная", "бюдж", 245, "Тестов5", "Иван"])
                    epgu = tmp / "epgu.xlsx"
                    workbook.save(epgu)
                    page.get_by_role("button", name="Загрузить Excel").click()
                    page.get_by_label("Excel-файл для загрузки").set_input_files(epgu)
                    page.get_by_role("button", name="Загрузить данные").click()
                    expect(page.get_by_role("heading", name="Обработка завершена")).to_be_visible()
                    page.get_by_role("button", name="Готово", exact=True).click()
                    expect(page.get_by_text("Тестов5 Иван", exact=True)).to_be_visible()

                    page.locator("nav").get_by_role("link", name="Договоры", exact=True).click()
                    page.get_by_role("button", name="TEST-2026-1", exact=True).click()
                    dialog = page.get_by_role("dialog")
                    dialog.get_by_label("На каком этапе").select_option("signed")
                    dialog.get_by_label("Где находится").select_option("accounting")
                    dialog.get_by_role("button", name="Обновить статус").click()
                    expect(page.locator("tbody").get_by_text("Подписан", exact=True)).to_be_visible()
                    workbook = Workbook()
                    workbook.active.append(["Номер договора", "Оплачен"])
                    workbook.active.append(["TEST-2026-1", "ДА"])
                    payment = tmp / "payments.xlsx"
                    workbook.save(payment)
                    page.get_by_role("button", name="Загрузить оплаты").click()
                    page.get_by_label("Excel-файл для загрузки").set_input_files(payment)
                    page.get_by_role("button", name="Загрузить данные").click()
                    expect(page.get_by_role("heading", name="Обработка завершена")).to_be_visible()
                    page.get_by_role("button", name="Готово", exact=True).click()
                    expect(page.locator("tbody").get_by_text("Оплачен", exact=True)).to_be_visible()

                    page.locator("nav").get_by_role("link", name="Звонки").click()
                    tomorrow = (datetime.now(ZoneInfo("Europe/Moscow")) + timedelta(days=1)).date().isoformat()
                    page.get_by_label("Изменение направления").fill(tomorrow)
                    page.get_by_label("Закрытие оплаты").fill(tomorrow)
                    expect(page.get_by_text("Звонков на выбранные сроки нет")).to_be_visible()  # Оплаченный договор исключён.

                    page.locator("nav").get_by_role("link", name="Отчёты", exact=True).click()
                    page.get_by_role("button", name="Конкурсные списки").click()
                    with page.expect_download() as info:
                        page.get_by_role("button", name="Скачать файл", exact=True).click()
                    result = load_workbook(io.BytesIO(Path(info.value.path()).read_bytes()), read_only=True)
                    assert result.active.max_row == 6  # Три исходных + добавленный + импортированный + заголовок.
                    result.close()
                    page.keyboard.press("Escape")

                    page.get_by_role("button", name="browser-operator").click()
                    page.get_by_role("button", name="Выйти из системы").click()
                    expect(page.get_by_role("heading", name="Добро пожаловать", exact=True)).to_be_visible()
                    assert not errors, errors
                    browser.close()
                    print("Browser smoke PASSED: demo navigation, search, card editing, quotas, plan, calls, CSV, mobile menu, login, real registration, contracts, payments, Excel export, logout; no JS errors.")
            finally:
                process.terminate()
                process.wait(timeout=10)


if __name__ == "__main__":
    main()
