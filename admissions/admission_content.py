import json
import re
from pathlib import Path
from typing import Annotated
from urllib.parse import quote
from uuid import uuid4

from fastapi import Depends, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, StringConstraints, model_validator
from sqlalchemy import JSON, LargeBinary, delete, func, select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

DATA = Path(__file__).with_name("admission_2026")
CATALOG = json.loads((DATA / "content.json").read_text(encoding="utf-8"))
DOCUMENTS = CATALOG["documents"]
DEFAULTS = CATALOG["pages"]
MAX_PDF = 24 * 1024 * 1024
MAX_PHOTO = 10 * 1024 * 1024
MAX_VIDEO = 64 * 1024 * 1024
BUNDLED_DOCUMENTS = {key for key in DOCUMENTS if (DATA / "documents" / f"{key}.pdf").is_file()}

Cell = Annotated[str, StringConstraints(max_length=1500)]
Row = Annotated[list[Cell], Field(min_length=1, max_length=9)]


class Block(BaseModel):
    heading: str = Field(max_length=220)
    text: str = Field(max_length=10000)
    columns: list[Cell] = Field(max_length=9)
    rows: list[Row] = Field(max_length=60)
    documents: list[str] = Field(max_length=len(DOCUMENTS))

    @model_validator(mode="after")
    def check_structure(self):
        if any(len(row) != len(self.columns) for row in self.rows):
            raise ValueError("Количество ячеек должно совпадать с количеством столбцов")
        if any(key not in DOCUMENTS for key in self.documents):
            raise ValueError("Неизвестный документ")
        return self


class PageContent(BaseModel):
    revision: int = Field(ge=0, le=2_000_000_000)
    title: str = Field(min_length=1, max_length=240)
    blocks: list[Block] = Field(min_length=1, max_length=24)


class AdmissionPage(Base):
    __tablename__ = "admission_public_pages"
    key: Mapped[str] = mapped_column(primary_key=True)
    revision: Mapped[int]
    content: Mapped[dict] = mapped_column(JSON)


class AdmissionDocument(Base):
    __tablename__ = "admission_public_documents"
    key: Mapped[str] = mapped_column(primary_key=True)
    content: Mapped[bytes] = mapped_column(LargeBinary)


class AdmissionMedia(Base):
    __tablename__ = "admission_public_media"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(unique=True)
    page: Mapped[str] = mapped_column(index=True)
    caption: Mapped[str]
    mime_type: Mapped[str]
    size: Mapped[int]
    content: Mapped[bytes] = mapped_column(LargeBinary)


def media_type(prefix: bytes) -> str:
    if prefix.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if prefix.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if prefix.startswith(b"RIFF") and prefix[8:16] in (b"WEBPVP8 ", b"WEBPVP8L", b"WEBPVP8X"):
        return "image/webp"
    if prefix[4:8] == b"ftyp" and len(prefix) >= 16:
        return "video/mp4"
    if prefix.startswith(b"\x1a\x45\xdf\xa3") and b"\x42\x82\x84webm" in prefix:
        return "video/webm"
    raise HTTPException(422, "Выберите фото JPEG, PNG, WebP или видео MP4, WebM")


def attach_admission_content(app, session, staff):
    @app.get("/admission-content/pages", dependencies=[Depends(staff)])
    def editable_pages(s=Depends(session)):
        saved = dict(s.execute(select(AdmissionPage.key, AdmissionPage.content)).all())
        from .assistant import page_link
        return [{"key": key, "title": saved.get(key, page)["title"], "href": page_link(key)}
                for key, page in DEFAULTS.items()]

    def page_default(key):
        if key not in DEFAULTS:
            raise HTTPException(404, "Страница не найдена")
        return DEFAULTS[key]

    def document_title(key):
        if key not in DOCUMENTS:
            raise HTTPException(404, "Документ не найден")
        return DOCUMENTS[key]

    @app.get("/public/admission/pages/{key}")
    def get_page(key: str, s=Depends(session)):
        default = page_default(key)
        saved = s.get(AdmissionPage, key)
        page = {"revision": saved.revision, **saved.content} if saved else {"revision": 0, **default}
        available = BUNDLED_DOCUMENTS.union(s.scalars(select(AdmissionDocument.key)))
        media = s.execute(select(
            AdmissionMedia.key, AdmissionMedia.caption, AdmissionMedia.mime_type
        ).where(AdmissionMedia.page == key).order_by(AdmissionMedia.id)).mappings()
        return {
            "page": page, "documents": DOCUMENTS, "available_documents": sorted(available),
            "media": [dict(item) for item in media],
        }

    @app.post("/admission-content/pages/{key}/media", status_code=201, dependencies=[Depends(staff)])
    def publish_media(key: str, file: UploadFile, caption: Annotated[str, Form(max_length=240)], s=Depends(session)):
        page_default(key)
        caption = caption.strip()
        if not caption:
            raise HTTPException(422, "Введите подпись к материалу")
        mime_type = media_type(file.file.read(4096))
        limit = MAX_PHOTO if mime_type.startswith("image/") else MAX_VIDEO
        file.file.seek(0)
        content = file.file.read(limit + 1)
        if len(content) > limit:
            raise HTTPException(413, f"Максимальный размер файла — {limit // (1024 * 1024)} МиБ")
        media_key = uuid4().hex
        s.add(AdmissionMedia(
            key=media_key, page=key, caption=caption, mime_type=mime_type, size=len(content), content=content
        ))
        return {"key": media_key, "caption": caption, "mime_type": mime_type}

    @app.delete("/admission-content/pages/{key}/media/{media_key}", dependencies=[Depends(staff)])
    def remove_media(key: str, media_key: str, s=Depends(session)):
        result = s.execute(delete(AdmissionMedia).where(AdmissionMedia.page == key, AdmissionMedia.key == media_key))
        if result.rowcount != 1:
            raise HTTPException(404, "Материал не найден")
        return {"key": media_key}

    @app.get("/public/admission/media/{media_key}")
    def get_media(media_key: str, range_header: Annotated[str | None, Header(alias="Range")] = None, s=Depends(session)):
        match_key = AdmissionMedia.key == media_key
        item = s.execute(select(AdmissionMedia.mime_type, AdmissionMedia.size).where(match_key)).one_or_none()
        if not item:
            raise HTTPException(404, "Материал не найден")
        mime_type, size = item
        headers = {"Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff"}
        if range_header is None:
            content = s.scalar(select(AdmissionMedia.content).where(match_key))
            if content is None:
                raise HTTPException(404, "Материал не найден")
            return Response(content, media_type=mime_type, headers=headers)
        match = re.fullmatch(r"bytes=([0-9]{0,19})-([0-9]{0,19})", range_header)
        if match and (match[1] or match[2]):
            start = int(match[1]) if match[1] else max(0, size - int(match[2]))
            end = min(int(match[2]), size - 1) if match[1] and match[2] else size - 1
            if start <= end:
                content = s.scalar(select(func.substr(AdmissionMedia.content, start + 1, end - start + 1)).where(match_key))
                if content is None:
                    raise HTTPException(404, "Материал не найден")
                headers["Content-Range"] = f"bytes {start}-{end}/{size}"
                return Response(content, status_code=206, media_type=mime_type, headers=headers)
        headers["Content-Range"] = f"bytes */{size}"
        return Response(status_code=416, headers=headers)

    @app.put("/admission-content/pages/{key}", dependencies=[Depends(staff)])
    def save_page(key: str, page: PageContent, s=Depends(session)):
        page_default(key)
        revision = page.revision + 1
        content = page.model_dump(exclude={"revision"})
        if page.revision == 0:
            statement = insert(AdmissionPage).values(key=key, revision=revision, content=content)
            statement = statement.on_conflict_do_nothing(index_elements=["key"])
        else:
            statement = update(AdmissionPage).where(
                AdmissionPage.key == key, AdmissionPage.revision == page.revision
            ).values(revision=revision, content=content)
        saved = s.execute(statement)
        if saved.rowcount != 1:
            raise HTTPException(409, "Страница уже изменена. Откройте её заново перед сохранением.")
        return {"revision": revision, **content}

    @app.get("/public/admission/documents/{key}")
    def get_document(key: str, s=Depends(session)):
        filename = document_title(key) + ".pdf"
        saved = s.get(AdmissionDocument, key)
        if saved:
            return Response(saved.content, media_type="application/pdf", headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename, safe='')}"
            })
        if key not in BUNDLED_DOCUMENTS:
            raise HTTPException(404, "PDF ещё не загружен")
        return FileResponse(DATA / "documents" / f"{key}.pdf", media_type="application/pdf", filename=filename)

    @app.put("/admission-content/documents/{key}", dependencies=[Depends(staff)])
    def replace_document(key: str, file: UploadFile, s=Depends(session)):
        document_title(key)
        content = file.file.read(MAX_PDF + 1)
        if len(content) > MAX_PDF:
            raise HTTPException(413, "Максимальный размер PDF — 24 МиБ")
        if not re.match(rb"%PDF-(?:1\.[0-7]|2\.0)[\r\n]", content) or not content.rstrip().endswith(b"%%EOF"):
            raise HTTPException(422, "Выберите файл PDF")
        statement = insert(AdmissionDocument).values(key=key, content=content)
        s.execute(statement.on_conflict_do_update(index_elements=["key"], set_={"content": content}))
        return {"key": key}
