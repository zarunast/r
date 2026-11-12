import argparse
import getpass
import json
import os
from pathlib import Path

from .db import Database
from .importer import import_epgu
from .security import add_user
from .services import backup_database


def main():
    parser = argparse.ArgumentParser(description="АИС приёмной комиссии БГТУ")
    parser.add_argument("--database", default=os.environ.get("DATABASE_URL", "sqlite:///data/admissions.sqlite3"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db")
    user = commands.add_parser("create-user")
    user.add_argument("login")
    importer = commands.add_parser("import-epgu")
    importer.add_argument("file", type=Path)
    importer.add_argument("--year", type=int, required=True)
    importer.add_argument("--sheet")
    backup = commands.add_parser("backup")
    backup.add_argument("destination", type=Path)
    args = parser.parse_args()
    db = Database(args.database)
    db.create_schema()
    try:
        if args.command == "create-user":
            password = getpass.getpass("Пароль: ")
            if password != getpass.getpass("Повтор пароля: "):
                parser.error("Пароли не совпадают")
            with db.uow() as session:
                add_user(session, args.login, password)
            print("Пользователь создан")
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
