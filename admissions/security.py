from datetime import datetime, timedelta, timezone
import os

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select

from .models import User


passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")


def validate_password(password):
    if len(password) < 10 or len(password.encode("utf-8")) > 72:
        raise ValueError("Пароль должен содержать от 10 символов до 72 байт UTF-8")


def add_user(session, login, password):
    validate_password(password)
    if not login.strip() or len(login) > 100:
        raise ValueError("Некорректный логин")
    if session.scalar(select(User).where(User.login == login)):
        raise ValueError("Пользователь уже существует")
    user = User(login=login, password_hash=passwords.hash(password))
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
