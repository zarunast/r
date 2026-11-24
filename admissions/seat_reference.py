"""Контрольные цифры БГТУ по состоянию на 15.04.2026."""
from collections import defaultdict
from functools import lru_cache
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert

from .contract_fields import PROGRAM_CODE
from .importer import normalize
from .models import Application, SeatPlan

DATA = Path(__file__).with_name("admission_2026")


@lru_cache
def reference():
    rows = []
    for level in ("bachelor", "specialist"):
        rows.extend({**row, "level": level} for row in json.loads(
            (DATA / f"{level}-seats.json").read_text(encoding="utf-8")
        ))
    return rows


def seed_seat_plans(session, year):
    if year != 2026:
        return 0
    by_program = defaultdict(list)
    for row in reference():
        by_program[(row["code"], normalize(row["study_form"]))].append(row)

    candidates = defaultdict(set)
    applications = session.scalars(select(Application).where(Application.year == year))
    for app in applications:
        direction = app.source.get("НПС/УГСН") or app.direction
        code = PROGRAM_CODE.search(str(direction))
        if not code or code.group().split(".")[1] not in {"03", "05"}:
            continue
        rows = by_program[(code.group(), normalize(app.study_form))]
        profile = normalize(app.source.get("Обр.программа") or PROGRAM_CODE.sub("", app.direction, count=1))
        matches = [row for row in rows if normalize(row["profile"]) == profile]
        if len(matches) == 1:
            group = (app.direction, app.campaign, app.study_form)
            # В исходном ЕПГУ «Направление» часто уже включает суффикс категории.
            candidates[(*group, app.quota)].add(matches[0]["seats"][app.quota])

    count = 0
    for (direction, campaign, form, quota), seats in candidates.items():
        if len(seats) != 1:
            continue
        result = session.execute(insert(SeatPlan).values(
            year=year, direction=direction, campaign=campaign, study_form=form,
            quota=quota, seats=next(iter(seats)),
        ).on_conflict_do_nothing())
        count += result.rowcount
    return count
