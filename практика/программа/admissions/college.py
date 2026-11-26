"""Правила учебного стенда СПО и представление конкурсного показателя."""
from decimal import Decimal, InvalidOperation
import re

from sqlalchemy import case, func


def is_college(campaign):
    return re.sub(r"[^а-я]", "", str(campaign).casefold()) in {
        "спо", "колледж", "среднеепрофессиональноеобразование",
    }


def campaign_name(campaign):
    return "СПО" if is_college(campaign) else campaign


def certificate_points(value):
    try:
        grade = Decimal(str(value).strip().replace(",", "."))
        if not grade.is_finite() or not Decimal(2) <= grade <= Decimal(5) or grade * 100 != int(grade * 100):
            raise ValueError
        return int(grade * 100)
    except (ValueError, InvalidOperation):
        raise ValueError("Средний балл документа об образовании должен быть от 2,00 до 5,00, до двух знаков после запятой") from None


def score_expression(columns):
    return case((func.lower(columns.campaign) == "спо", columns.total_score / 100.0),
                else_=columns.total_score)


def display_score(application):
    return application.total_score / 100 if is_college(application.campaign) else application.total_score
