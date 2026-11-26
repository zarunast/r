import argparse
import getpass
import json
import os
from pathlib import Path

from .db import Database
from .importer import import_epgu
from .security import ROLES, add_user, issue_invitation
from .services import backup_database


def main():
    parser = argparse.ArgumentParser(description="АИС приёмной комиссии БГТУ")
    parser.add_argument("--database", default=os.environ.get("DATABASE_URL", "sqlite:///data/admissions.sqlite3"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db")
    commands.add_parser("presentation", help="Создать отдельную демонстрационную базу")
    user = commands.add_parser("create-user")
    user.add_argument("login")
    user.add_argument("--role", choices=ROLES, default="operator")
    invite = commands.add_parser("invite-user", help="Выдать одноразовый код регистрации")
    invite.add_argument("--role", choices=ROLES, required=True)
    importer = commands.add_parser("import-epgu")
    importer.add_argument("file", type=Path)
    importer.add_argument("--year", type=int, required=True)
    importer.add_argument("--sheet")
    backup = commands.add_parser("backup")
    backup.add_argument("destination", type=Path)
    args = parser.parse_args()
    if args.command == "presentation":
        from .presentation import DATABASE_URL, PASSWORD, seed_presentation
        seed_presentation()
        print(DATABASE_URL)
        print("demo-secretary / demo-teacher / demo-editor")
        print(PASSWORD)
        return 0
    db = Database(args.database)
    db.create_schema()
    try:
        if args.command == "create-user":
            password = getpass.getpass("Пароль: ")
            if password != getpass.getpass("Повтор пароля: "):
                parser.error("Пароли не совпадают")
            with db.uow() as session:
                add_user(session, args.login, password, args.role)
            print("Пользователь создан")
        elif args.command == "invite-user":
            with db.uow() as session:
                code = issue_invitation(session, args.role)
            print(code)
        elif args.command == "import-epgu":
            report = import_epgu(db, args.file, args.year, args.sheet)
            print(json.dumps(report.as_dict(), ensure_ascii=False, indent=2))
            if report.errors:
                return 2
        elif args.command == "backup":
            print(backup_database(db, args.destination))
        else:
            print("Схема создана")
    except (ValueError, OSError) as error:
        parser.error(str(error))
    finally:
        db.engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
