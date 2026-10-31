"""Служебные представления для внутреннего сайта. Все данные доступны только после входа."""
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select

from .models import ActivityEvent, Applicant, Application, Contract, SeatPlan
from . import services as svc


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def record_activity(session, request):
    actor = getattr(request.state, "actor", None)
    if request.method not in {"POST", "PATCH", "PUT", "DELETE"} or not actor:
        return
    path = request.url.path
    if path.startswith("/imports/epgu"):
        action, target = "Импортирована выгрузка ЕПГУ", "Реестр абитуриентов"
    elif path.startswith("/imports/payments"):
        action, target = "Обновлены подтверждения оплаты", "Реестр договоров"
    elif path.startswith("/contracts") and path.endswith("/document"):
        action, target = "Сформирован документ договора", "Документы"
    elif path.startswith("/contracts"):
        action, target = ("Создан договор" if request.method == "POST" else "Изменён статус договора"), "Реестр договоров"
    elif path.startswith("/applicants") or path == "/registry":
        action, target = ("Добавлен абитуриент" if request.method == "POST" else "Обновлена карточка абитуриента"), "Реестр абитуриентов"
    elif path.endswith("/enroll"):
        action, target = "Внесён приказ о зачислении", "Зачисление"
    elif path.startswith("/applications"):
        action, target = ("Добавлено заявление" if request.method == "POST" else "Обновлено заявление"), "Заявления"
    elif path.startswith("/seat-plans"):
        action, target = "Обновлен план приёма", "Конкурсные списки"
    elif path.startswith("/calls"):
        action, target = "Сохранён результат звонка", "Список обзвона"
    else:
        return
    session.add(ActivityEvent(actor=actor, action=action, object=target))


def attach_web(app, db, session, staff):
    private = [Depends(staff)]

    @app.get("/auth/me", dependencies=private)
    def me(user=Depends(staff)):
        return {"id": user.id, "login": user.login, "display_name": user.login, "role": "Сотрудник приёмной комиссии"}

    @app.get("/dashboard", dependencies=private)
    def dashboard(year: int = Query(ge=2000, le=2100), s=Depends(session)):
        today = datetime.now(ZoneInfo("Europe/Moscow")).date()
        stats = svc.statistics(s, year)
        received_date = func.substr(Application.source["Дата получения документов"].as_string(), 1, 10)
        today_count = s.scalar(select(func.count()).select_from(Application).where(
            Application.year == year, received_date.in_([today.strftime("%d.%m.%Y"), today.isoformat()])))
        paid = s.scalar(select(func.count()).select_from(Contract).join(Application).where(
            Application.year == year, Contract.paid.is_(True), Contract.stage != "cancelled"))
        return {"date": today.isoformat(), "year": year, "applicants": stats["applicants"],
                "applications": stats["applications"], "applications_today": today_count,
                "paid_contracts": paid, "overcrowded": len({g["direction"] for g in stats["groups"] if g["overcrowded"] is True}),
                "plan_count": sum(g["seats"] is not None for g in stats["groups"]),
                "enrolled": stats["statuses"].get("enrolled", 0)}

    @app.get("/activities", dependencies=private)
    def activities(limit: int = Query(10, ge=1, le=100), offset: int = Query(0, ge=0), s=Depends(session)):
        total = s.scalar(select(func.count()).select_from(ActivityEvent))
        rows = s.scalars(select(ActivityEvent).order_by(ActivityEvent.at.desc(), ActivityEvent.id.desc()).limit(limit).offset(offset))
        return {"total": total, "items": [{"id": e.id, "at": utc(e.at), "actor": e.actor, "action": e.action,
                                           "object": e.object, "detail": e.detail, "status": e.status} for e in rows]}

    @app.get("/catalog/groups", dependencies=private)
    def groups(year: int, s=Depends(session)):
        rows = s.execute(select(Application.direction, Application.campaign, Application.study_form)
                         .where(Application.year == year).distinct().order_by(Application.direction, Application.campaign, Application.study_form))
        return [{"direction": d, "campaign": c, "study_form": f} for d, c, f in rows]

    @app.get("/registry", dependencies=private)
    def registry(year: int, q: str = "", direction: str | None = None, quota: str | None = None,
                 status: str | None = None, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), s=Depends(session)):
        matching = select(Application).where(Application.year == year)
        for field, value in {"direction": direction, "quota": quota, "status": status}.items():
            if value:
                matching = matching.where(getattr(Application, field) == value)
        app_set = matching.subquery()
        summary = select(app_set.c.applicant_number.label("number"), func.count().label("applications_count"),
                         func.max(app_set.c.total_score).label("best_score")).group_by(app_set.c.applicant_number).subquery()
        stmt = select(Applicant, summary.c.applications_count, summary.c.best_score).join(summary, Applicant.number == summary.c.number)
        if q:
            full_name = Applicant.surname + " " + Applicant.first_name + " " + Applicant.patronymic
            stmt = stmt.where(or_(Applicant.number.icontains(q, autoescape=True), full_name.icontains(q, autoescape=True)))
        total = s.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = s.execute(stmt.order_by(Applicant.surname, Applicant.first_name, Applicant.number).limit(limit).offset(offset))
        return {"total": total, "items": [{"number": a.number, "surname": a.surname, "first_name": a.first_name,
                                           "patronymic": a.patronymic, "phone": a.profile.get("Телефон", ""),
                                           "email": a.profile.get("Почта", ""), "applications_count": count,
                                           "best_score": score} for a, count, score in rows]}

    @app.get("/rankings", dependencies=private)
    def rankings(year: int, direction: str, campaign: str, study_form: str, s=Depends(session)):
        public = svc.all_rankings(s, year, direction, campaign, study_form)
        people = {(a.applicant_number, a.quota): (a, p) for a, p in s.execute(
            svc.group_query(year, direction, campaign, study_form).add_columns(Applicant).join(Applicant))}
        for quota, rows in public.items():
            for row in rows:
                a, p = people[(row["applicant_number"], quota)]
                row.update(application_id=a.id, full_name=" ".join(filter(None, [p.surname, p.first_name, p.patronymic])),
                           consent=a.consent, priority=a.priority, status=a.status)
        plans = {p.quota: p.seats for p in s.scalars(select(SeatPlan).where(SeatPlan.year == year,
                 SeatPlan.direction == direction, SeatPlan.campaign == campaign, SeatPlan.study_form == study_form))}
        return {"lists": public, "seats": plans}

    @app.get("/contracts", dependencies=private)
    def contracts(year: int, q: str = "", stage: str | None = None, paid: bool | None = None,
                  limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), s=Depends(session)):
        stmt = select(Contract, Application, Applicant).join(Application, Contract.application_id == Application.id).join(
            Applicant, Application.applicant_number == Applicant.number).where(Application.year == year)
        if q:
            full_name = Applicant.surname + " " + Applicant.first_name + " " + Applicant.patronymic
            stmt = stmt.where(or_(Contract.number.icontains(q, autoescape=True), Applicant.number.icontains(q, autoescape=True),
                                  full_name.icontains(q, autoescape=True)))
        if stage:
            stmt = stmt.where(Contract.stage == stage)
        if paid is not None:
            stmt = stmt.where(Contract.paid == paid)
        total = s.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = s.execute(stmt.order_by(Contract.created_at.desc(), Contract.id.desc()).limit(limit).offset(offset))
        return {"total": total, "items": [{"id": c.id, "number": c.number, "application_id": a.id,
                    "applicant_number": a.applicant_number, "full_name": " ".join(filter(None, [p.surname, p.first_name, p.patronymic])),
                    "direction": a.direction, "study_form": a.study_form, "location": c.location,
                    "stage": c.stage, "paid": c.paid, "created_at": utc(c.created_at)} for c, a, p in rows]}

    # Hash-навигация SPA не требует перехватывать неизвестные API-маршруты.
    dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="web-assets")

        @app.get("/", include_in_schema=False)
        def site():
            return FileResponse(dist / "index.html")

        @app.get("/favicon.svg", include_in_schema=False)
        def favicon():
            return FileResponse(dist / "favicon.svg")
