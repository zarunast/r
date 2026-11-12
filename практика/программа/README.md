# АИС приёмной комиссии

Python 3.11+, FastAPI, SQLAlchemy, SQLite; интерфейсы React и TypeScript. Для сборки нужен Node.js 20.19+ либо 22.12+ (проверено также на Node.js 24).

## Установка и запуск

Выполните из каталога `практика/программа`:

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
npm --prefix frontend ci --cache /workspace/.npm-cache
npm --prefix frontend run build
umask 077
export DATABASE_URL=sqlite:///data/admissions.sqlite3
export JWT_SECRET="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
.venv/bin/python -m admissions init-db
.venv/bin/python -m admissions create-user secretary
.venv/bin/uvicorn admissions.api:create_app --factory --host 127.0.0.1 --port 8000 --no-proxy-headers
```

Пароль пользователя вводится скрыто. Случайный JWT_SECRET действует до завершения оболочки; для постоянного развёртывания требуется защищённое хранение секрета. База создаётся локально и не включена в исходники.

Сервер обслуживает внутренний интерфейс `/`, портал `/abiturient/`, описание API `/docs` и проверку подключения к базе `/health`.

## Проверка

```bash
.venv/bin/python -m pytest -q
```

Тесты используют временные базы и синтетические данные. В копию не включены базы, учётные записи, виртуальное окружение, node_modules и сборка. Правила конкурсного отбора для СПО требуют отдельной адаптации и проверки до использования в реальном приёме.
