"""Публичный каталог: только сведения о конкурсах, без персональных данных."""
import re

from fastapi import Depends, Query
from sqlalchemy import case, func, select

from .models import Application, Quota, SeatPlan
from .services import ACTIVE


def attach_portal(app, session):
    @app.get("/public/catalog")
    def catalog(year: int = Query(ge=2000, le=2100), s=Depends(session)):
        result = {}

        def group(direction, campaign, study_form):
            key = (direction, campaign, study_form)
            if key not in result:
                result[key] = {"direction": direction, "campaign": campaign, "study_form": study_form,
                               "title": direction, "code": None,
                               "categories": [],
                               "seats": {q.value: None for q in Quota},
                               "applications": {q.value: 0 for q in Quota}}
            return result[key]

        rows = s.execute(select(
            Application.direction, Application.campaign, Application.study_form, Application.quota,
            func.sum(case((Application.status.in_(ACTIVE), 1), else_=0)),
            func.min(Application.source["Обр.программа"].as_string()),
            func.min(Application.source["НПС/УГСН"].as_string()),
        ).where(Application.year == year).group_by(
            Application.direction, Application.campaign, Application.study_form, Application.quota))
        for direction, campaign, study_form, quota, count, title, field in rows:
            item = group(direction, campaign, study_form)
            if quota in item["applications"]:
                item["applications"][quota] = count
                if quota not in item["categories"]:
                    item["categories"].append(quota)
            if title:
                item["title"] = title
            match = re.search(r"\b\d{2}\.\d{2}\.\d{2}\b", field or "")
            if match:
                item["code"] = match.group()
        for plan in s.scalars(select(SeatPlan).where(SeatPlan.year == year)):
            item = group(plan.direction, plan.campaign, plan.study_form)
            if plan.quota in item["seats"]:
                item["seats"][plan.quota] = plan.seats
                if plan.quota not in item["categories"]:
                    item["categories"].append(plan.quota)
        years = set(s.scalars(select(Application.year).distinct())) | set(s.scalars(select(SeatPlan.year).distinct()))
        return {"year": year, "years": sorted(years | {year}, reverse=True),
                "groups": sorted(result.values(), key=lambda item: (item["title"], item["campaign"], item["study_form"]))}
