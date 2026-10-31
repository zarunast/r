from contextlib import asynccontextmanager, contextmanager
from datetime import date, datetime, timezone
import ipaddress
import os
from pathlib import Path
import tempfile
from typing import Literal
from zipfile import BadZipFile, ZipFile

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from .db import Database
from .importer import import_epgu
from .models import Applicant, Application, Call, Contract, ContractEvent, Quota, SeatPlan, User, now
from .security import authenticate, decode_token, token_for
from . import services as svc


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ApplicantData(Input):
    number: str = Field(pattern=r"^[0-9A-Za-z_-]{1,64}$")
    surname: str = Field(default="", max_length=200)
    first_name: str = Field(default="", max_length=200)
    patronymic: str = Field(default="", max_length=200)
    profile: dict = Field(default_factory=dict)


class ApplicantPatch(Input):
    surname: str | None = Field(default=None, max_length=200)
    first_name: str | None = Field(default=None, max_length=200)
    patronymic: str | None = Field(default=None, max_length=200)
    profile: dict | None = None


class Group(Input):
    year: int = Field(ge=2000, le=2100)
    direction: str = Field(min_length=1, max_length=300)
    campaign: str = Field(min_length=1, max_length=100)
    study_form: str = Field(min_length=1, max_length=100)
    quota: Quota = Quota.GENERAL


class ApplicationData(Group):
    applicant_number: str
    priority: int = Field(default=1, ge=1, le=100)
    exam_scores: dict[str, int] = Field(default_factory=dict)
    achievements: int = Field(default=0, ge=0, le=100)
    consent: bool = False


class ApplicationPatch(Input):
    status: Literal["participating", "pending", "accepted", "withdrawn", "rejected"] | None = None
    priority: int | None = Field(default=None, ge=1, le=100)
    consent: bool | None = None
    exam_scores: dict[str, int] | None = None
    achievements: int | None = Field(default=None, ge=0, le=100)


class PlanData(Group):
    seats: int = Field(ge=0, le=100000)


class ContractData(Input):
    application_id: int
    number: str = Field(min_length=1, max_length=100)


class ContractPatch(Input):
    location: Literal["admissions", "applicant", "accounting", "archive"] | None = None
    stage: Literal["draft", "issued", "signed", "registered", "cancelled"] | None = None


class CallData(Input):
    application_id: int
    result: Literal["no_answer", "interested", "callback", "declined", "confirmed"]
    comment: str = Field(default="", max_length=2000)


class EnrollmentData(Input):
    order_number: str = Field(min_length=1, max_length=100)
    enrolled_at: date


def model_dict(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def score_values(exams, achievements):
    if not exams or any(type(v) is not int or not 0 <= v <= 100 for v in exams.values()):
        raise ValueError("Укажите выбранные для конкурса экзамены с баллами от 0 до 100")
    return sum(exams.values()) + achievements


@contextmanager
def upload_path(file, suffix, limit=25 * 1024 * 1024):
    with tempfile.TemporaryDirectory(prefix="admissions-") as folder:
        path = Path(folder) / ("upload" + suffix)
        size = 0
        with path.open("wb") as stream:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, "Файл больше 25 МБ")
                stream.write(chunk)
        try:
            with ZipFile(path) as archive:
                if sum(i.file_size for i in archive.infolist()) > 200 * 1024 * 1024:
                    raise HTTPException(413, "Слишком большой распакованный документ")
        except BadZipFile:
            raise ValueError("Ожидается корректный XLSX/DOCX файл") from None
        yield path


def create_app(database_url=None, jwt_secret=None, internal_networks=None):
    secret = jwt_secret or os.environ.get("JWT_SECRET", "")
    if len(secret.encode()) < 32:
        raise RuntimeError("Задайте JWT_SECRET длиной не менее 32 байт")
    db = Database(database_url or os.environ.get("DATABASE_URL", "sqlite:///data/admissions.sqlite3"))
    networks = [ipaddress.ip_network(s.strip()) for s in
                (internal_networks or os.environ.get("INTERNAL_NETWORKS", "127.0.0.0/8,::1/128")).split(",")]

    @asynccontextmanager
    async def lifespan(app):
        db.create_schema()
        yield
        db.engine.dispose()

    app = FastAPI(title="АИС приёмной комиссии БГТУ", version="0.1.0", lifespan=lifespan)
    app.state.db = db
    oauth = OAuth2PasswordBearer(tokenUrl="/auth/token")

    @app.exception_handler(ValueError)
    async def bad_value(request, exc):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(LookupError)
    async def missing(request, exc):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(IntegrityError)
    async def conflict(request, exc):
        return JSONResponse(status_code=409, content={"detail": "Конфликт уникальности или связанных записей"})

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    def session():
        with db.uow() as s:
            yield s

    def local_only(request: Request):
        try:
            address = ipaddress.ip_address(request.client.host)
        except (ValueError, AttributeError):
            raise HTTPException(403, "Доступ только из сети приёмной комиссии") from None
        if not any(address in n for n in networks):
            raise HTTPException(403, "Доступ только из сети приёмной комиссии")

    def staff(token=Depends(oauth), s=Depends(session), _=Depends(local_only)):
        try:
            user_id = decode_token(token, secret)
        except ValueError:
            raise HTTPException(401, "Недействительный токен", headers={"WWW-Authenticate": "Bearer"}) from None
        user = s.get(User, user_id)
        if not user or not user.active:
            raise HTTPException(401, "Пользователь недоступен")
        return user

    private = [Depends(staff)]

    @app.get("/health")
    def health(s=Depends(session)):
        s.execute(select(1))
        return {"status": "ok"}

    @app.post("/auth/token", dependencies=[Depends(local_only)])
    def login(form: OAuth2PasswordRequestForm = Depends(), s=Depends(session)):
        user = authenticate(s, form.username, form.password)
        if user is None:
            raise HTTPException(401, "Неверный логин или пароль")
        return {"access_token": token_for(user, secret), "token_type": "bearer"}

    @app.post("/imports/epgu", dependencies=private)
    def epgu(year: int = Query(ge=2000, le=2100), sheet: str | None = None, file: UploadFile = File()):
        with upload_path(file, ".xlsx") as path:
            return import_epgu(db, path, year, sheet).as_dict()

    @app.get("/applicants", dependencies=private)
    def applicants(q: str = "", year: int | None = None, contract_number: str | None = None,
                   limit: int = Query(50, ge=1, le=1000), offset: int = Query(0, ge=0), s=Depends(session)):
        stmt = select(Applicant)
        if q:
            stmt = stmt.where(or_(Applicant.number == q, Applicant.surname.icontains(q, autoescape=True),
                                  Applicant.first_name.icontains(q, autoescape=True), Applicant.patronymic.icontains(q, autoescape=True)))
        if year is not None or contract_number is not None:
            sub = select(Application.applicant_number)
            if year is not None:
                sub = sub.where(Application.year == year)
            if contract_number is not None:
                sub = sub.join(Contract).where(Contract.number == contract_number)
            stmt = stmt.where(Applicant.number.in_(sub))
        return [model_dict(a) for a in s.scalars(stmt.order_by(Applicant.number).limit(limit).offset(offset))]

    @app.post("/applicants", dependencies=private, status_code=201)
    def add_applicant(body: ApplicantData, s=Depends(session)):
        person = Applicant(**body.model_dump())
        s.add(person)
        s.flush()
        return model_dict(person)

    @app.get("/applicants/{number}", dependencies=private)
    def applicant(number: str, s=Depends(session)):
        person = svc.require(s, Applicant, number)
        apps = s.scalars(select(Application).where(Application.applicant_number == number)).all()
        contracts = s.scalars(select(Contract).join(Application).where(Application.applicant_number == number)).all()
        return {**model_dict(person), "applications": [model_dict(a) for a in apps],
                "contracts": [model_dict(c) for c in contracts]}

    @app.patch("/applicants/{number}", dependencies=private)
    def edit_applicant(number: str, body: ApplicantPatch, s=Depends(session)):
        person = svc.require(s, Applicant, number)
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(person, k, {**person.profile, **v} if k == "profile" else v)
        person.updated_at = now()
        return model_dict(person)

    @app.post("/applications", dependencies=private, status_code=201)
    def add_application(body: ApplicationData, s=Depends(session)):
        svc.require(s, Applicant, body.applicant_number)
        values = body.model_dump(exclude={"exam_scores"})
        values["quota"] = body.quota.value
        app_obj = Application(**values, exams=body.exam_scores,
                              total_score=score_values(body.exam_scores, body.achievements))
        s.add(app_obj)
        s.flush()
        return model_dict(app_obj)

    @app.patch("/applications/{application_id}", dependencies=private)
    def edit_application(application_id: int, body: ApplicationPatch, s=Depends(session)):
        obj = svc.require(s, Application, application_id)
        values = body.model_dump(exclude_none=True)
        if obj.enrolled_at and values:
            raise ValueError("Зачисленное заявление нельзя менять без отмены приказа в отдельной процедуре")
        if "achievements" in values and "exam_scores" not in values:
            raise ValueError("Для пересчёта ИД передайте выбранные exam_scores: в Excel есть альтернативные экзамены")
        if "exam_scores" in values:
            exams = values.pop("exam_scores")
            obj.total_score = score_values(exams, values.get("achievements", obj.achievements))
            obj.exams = exams
        for k, v in values.items():
            setattr(obj, k, v)
        return model_dict(obj)

    @app.put("/seat-plans", dependencies=private)
    def plan(body: PlanData, s=Depends(session)):
        values = body.model_dump()
        values["quota"] = body.quota.value
        conditions = [getattr(SeatPlan, k) == v for k, v in values.items() if k != "seats"]
        obj = s.scalar(select(SeatPlan).where(*conditions))
        if obj:
            obj.seats = body.seats
        else:
            obj = SeatPlan(**values)
            s.add(obj)
        s.flush()
        return model_dict(obj)

    @app.get("/public/rankings")
    def public_rankings(year: int, direction: str, campaign: str, study_form: str, s=Depends(session)):
        return svc.all_rankings(s, year, direction, campaign, study_form)

    @app.get("/public/applicants/{number}")
    def public_applicant(number: str, year: int, s=Depends(session)):
        rows = s.scalars(svc.group_query(year).where(Application.applicant_number == number)).all()
        if not rows:
            raise LookupError("Заявления не найдены")
        return [{"applicant_number": a.applicant_number, "score": a.total_score, "quota": a.quota,
                 "direction": a.direction, "campaign": a.campaign, "study_form": a.study_form,
                 "forecast": svc.forecast(s, a)} for a in rows]

    @app.get("/public/faq")
    def faq(question: str = Query(min_length=1, max_length=1000)):
        return {"answer": svc.chatbot(question)}

    @app.post("/contracts", dependencies=private, status_code=201)
    def new_contract(body: ContractData, user=Depends(staff), s=Depends(session)):
        return model_dict(svc.create_contract(s, body.application_id, body.number, user.login))

    @app.patch("/contracts/{contract_id}", dependencies=private)
    def contract_status(contract_id: int, body: ContractPatch, user=Depends(staff), s=Depends(session)):
        return model_dict(svc.update_contract(s, svc.require(s, Contract, contract_id), user.login,
                                              **body.model_dump(exclude_none=True)))

    @app.get("/contracts/{contract_id}/history", dependencies=private)
    def history(contract_id: int, s=Depends(session)):
        svc.require(s, Contract, contract_id)
        return [model_dict(e) for e in s.scalars(select(ContractEvent).where(ContractEvent.contract_id == contract_id)
                                                .order_by(ContractEvent.at, ContractEvent.id))]

    @app.post("/contracts/{contract_id}/document", dependencies=private)
    def contract_document(contract_id: int, template: UploadFile = File(), s=Depends(session)):
        contract = svc.require(s, Contract, contract_id)
        with upload_path(template, ".docx") as path:
            content = svc.render_contract(s, contract, path)
        return Response(content, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        headers={"Content-Disposition": 'attachment; filename="contract.docx"'})

    @app.post("/imports/payments", dependencies=private)
    def payments(file: UploadFile = File(), user=Depends(staff), s=Depends(session)):
        with upload_path(file, ".xlsx") as path:
            return svc.reconcile_payments(s, path, user.login)

    @app.get("/calls/queue", dependencies=private)
    def calls(year: int, change_deadline: date, payment_deadline: date, s=Depends(session)):
        return svc.call_queue(s, year, change_deadline, payment_deadline)

    @app.post("/calls", dependencies=private, status_code=201)
    def log_call(body: CallData, user=Depends(staff), s=Depends(session)):
        svc.require(s, Application, body.application_id)
        obj = Call(**body.model_dump(), actor=user.login)
        s.add(obj)
        s.flush()
        return model_dict(obj)

    @app.post("/applications/{application_id}/enroll", dependencies=private)
    def enroll(application_id: int, body: EnrollmentData, s=Depends(session)):
        obj = svc.require(s, Application, application_id)
        if obj.status not in svc.ACTIVE or obj.enrolled_at:
            raise ValueError("Заявление не участвует в конкурсе или уже зачислено")
        other = s.scalar(select(Application).where(Application.applicant_number == obj.applicant_number,
                         Application.year == obj.year, Application.campaign == obj.campaign, Application.status == "enrolled"))
        if other:
            raise ValueError("Абитуриент уже зачислен в этой кампании")
        if obj.quota == Quota.PAID.value:
            contract = s.scalar(select(Contract).where(Contract.application_id == obj.id))
            if not contract or not contract.paid or contract.stage != "registered":
                raise ValueError("Для платного зачисления нужен зарегистрированный оплаченный договор")
        elif not obj.consent:
            raise ValueError("Для бюджетного зачисления требуется согласие")
        obj.status = "enrolled"
        obj.enrolled_at = datetime.combine(body.enrolled_at, datetime.min.time(), timezone.utc)
        obj.source = {**obj.source, "enrollment_order": body.order_number}
        return model_dict(obj)

    @app.get("/reports/statistics", dependencies=private)
    def stats(year: int, s=Depends(session)):
        return svc.statistics(s, year)

    @app.get("/reports/ranking", dependencies=private)
    def report(year: int, direction: str, campaign: str, study_form: str, quota: Quota,
               format: Literal["xlsx", "pdf"] = "xlsx", s=Depends(session)):
        rows = svc.ranking(s, year, direction, campaign, study_form, quota.value)
        content = svc.xlsx_bytes(rows) if format == "xlsx" else svc.pdf_bytes(rows)
        return Response(content, media_type="application/pdf" if format == "pdf" else
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="ranking.{format}"'})

    @app.get("/reports/accounting", dependencies=private)
    def accounting(year: int, s=Depends(session)):
        rows = [{"contract_number": c.number, "applicant_number": a.applicant_number,
                 "direction": a.direction, "stage": c.stage, "paid": c.paid}
                for c, a in s.execute(select(Contract, Application).join(Application).where(Application.year == year))]
        return Response(svc.xlsx_bytes(rows), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    @app.get("/exports/1c", dependencies=private)
    def one_c(year: int, format: Literal["json", "xml"] = "json", s=Depends(session)):
        return Response(svc.export_1c(s, year, format), media_type="application/json" if format == "json" else "application/xml")

    return app
