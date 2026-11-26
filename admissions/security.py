from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select

from .models import StaffInvitation, User


passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")
ROLES = {
    "operator": "Сотрудник приёмной комиссии",
    "editor": "Редактор сайта абитуриента",
    "examiner": "Проверяющий экзамены",
}


def validate_password(password):
    if len(password) < 10 or len(password.encode("utf-8")) > 72:
        raise ValueError("Пароль должен содержать от 10 символов до 72 байт UTF-8")


def add_user(session, login, password, role="operator"):
    validate_password(password)
    if role not in ROLES:
        raise ValueError("Неизвестная роль")
    if not login.strip() or len(login) > 100:
        raise ValueError("Некорректный логин")
    if session.scalar(select(User).where(User.login == login)):
        raise ValueError("Пользователь уже существует")
    user = User(login=login, password_hash=passwords.hash(password), role=role)
    session.add(user)
    return user


def authenticate(session, login, password):
    user = session.scalar(select(User).where(User.login == login))
    if len(password.encode("utf-8")) > 72:
        return None
    # Dummy hash снижает различие времени ответа для неизвестного логина.
    valid = passwords.verify(password, user.password_hash if user else DUMMY_HASH)
    return user if user and user.active and valid else None


DUMMY_HASH = passwords.hash("unused-dummy-password")


def token_for(user, secret):
    current = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "iat": current, "exp": current + timedelta(hours=8),
                       "iss": "bgtu-admissions", "aud": "staff"}, secret, algorithm="HS256")


def decode_token(token, secret):
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"], issuer="bgtu-admissions", audience="staff",
                            options={"require_exp": True, "require_sub": True})
        return int(claims["sub"])
    except (JWTError, ValueError, KeyError):
        raise ValueError("Недействительный или просроченный токен") from None


def issue_invitation(session, role):
    if role not in ROLES:
        raise ValueError("Неизвестная роль")
    code = token_urlsafe(32)
    session.add(StaffInvitation(digest=sha256(code.encode()).hexdigest(), role=role,
                                expires_at=datetime.now(timezone.utc) + timedelta(hours=24)))
    return code


def register_staff(session, login, password, role, code):
    validate_password(password)
    claimed = session.scalar(delete(StaffInvitation).where(
        StaffInvitation.digest == sha256(code.strip().encode()).hexdigest(),
        StaffInvitation.role == role,
        StaffInvitation.expires_at > datetime.now(timezone.utc),
    ).returning(StaffInvitation.digest))
    if claimed is None:
        raise ValueError("Код недействителен для выбранной роли или срок его действия истёк")
    add_user(session, login.strip(), password, role)
