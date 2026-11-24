"""Состав конкурсной суммы при ручном внесении результатов."""
from .contract_fields import PROGRAM_CODE


def subject_groups(direction, source=None):
    code = PROGRAM_CODE.search(str((source or {}).get("НПС/УГСН") or direction))
    if not code:
        return ()
    family, level, _ = code.group().split(".")
    if level == "04":
        return (("Междисциплинарный экзамен",),)
    if level not in {"03", "05"}:
        return ()
    if family in {"02", "09", "10"} or code.group() == "27.03.05":
        profile = ("Информатика", "Прикладная информатика")
    elif family in {"38", "44"}:
        profile = ("Обществознание", "Основы экономики") if family == "38" else ("Обществознание", "Основы педагогики")
    elif family in {"11", "13", "15", "20", "22", "23", "27"}:
        profile = ("Механика", "Физика")
    else:
        return ()
    # Профильный предмет и математика опираются на группы 2019 года.
    # Русский включён по правилам проекта, сформулированным пользователем.
    return (profile, ("Русский язык",), ("Математика", "Прикладная математика"))


def selected_scores(exams, groups):
    selected = {}
    for alternatives in groups:
        subject = next((name for name in alternatives if name in exams), None)
        if subject is None:
            raise ValueError("Для этой программы нужен результат: " + " или ".join(alternatives))
        selected[subject] = exams[subject]
    return selected
