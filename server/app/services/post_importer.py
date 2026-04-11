from __future__ import annotations

from io import BytesIO
import re
from typing import Any
from urllib.parse import unquote, urlparse

import httpx
from bs4 import BeautifulSoup
from markdownify import markdownify as html_to_markdown
from pypdf import PdfReader


TITLE_MAX = 120
SUMMARY_MAX = 160


def import_post_from_bytes(filename: str, data: bytes, content_type: str | None = None) -> dict[str, Any]:
    lower_name = filename.lower()
    if lower_name.endswith((".md", ".markdown", ".txt")) or (content_type and "markdown" in content_type):
        text = _decode_text(data)
        return _build_result(title=_title_from_filename(filename), content=text, source_type="markdown")

    if lower_name.endswith(".pdf") or content_type == "application/pdf":
        text = _extract_pdf_text(data)
        return _build_result(title=_title_from_filename(filename), content=text, source_type="pdf")

    if lower_name.endswith((".html", ".htm")) or (content_type and "html" in content_type):
        title, markdown = _html_document_to_markdown(data.decode("utf-8", errors="ignore"))
        return _build_result(title=title or _title_from_filename(filename), content=markdown, source_type="html")

    raise ValueError("Unsupported file type. Please upload PDF, Markdown, TXT, or HTML.")


def import_post_from_url(url: str) -> dict[str, Any]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https URLs are supported.")

    headers = {
        "User-Agent": "NeoBlogImporter/1.0 (+https://li-neo.top)",
        "Accept": "text/html,application/pdf,text/markdown,text/plain;q=0.9,*/*;q=0.8",
    }
    with httpx.Client(follow_redirects=True, timeout=20.0, headers=headers) as client:
        response = client.get(url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    disposition = response.headers.get("content-disposition", "")
    filename = _filename_from_url(url) or _filename_from_disposition(disposition) or "imported-document"

    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        result = import_post_from_bytes(filename, response.content, content_type="application/pdf")
    elif "markdown" in content_type or filename.lower().endswith((".md", ".markdown", ".txt")):
        result = import_post_from_bytes(filename, response.content, content_type=content_type or "text/markdown")
    else:
        title, markdown = _html_document_to_markdown(response.text)
        result = _build_result(title=title or _title_from_filename(filename), content=markdown, source_type=_url_source_type(url))

    result["source_url"] = url
    return result


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "gb18030", "latin-1"):
        try:
            return data.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore").strip()


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(part.strip() for part in pages if part.strip()).strip()
    if not text:
        raise ValueError("Unable to extract text from PDF. Please export as Markdown/HTML or paste content manually.")
    return text


def _html_document_to_markdown(html: str) -> tuple[str | None, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = _extract_title(soup)

    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()

    root = (
        soup.select_one(".notion-page-content")
        or soup.select_one(".op-symbol-doc-content")
        or soup.select_one(".lark-doc-content")
        or soup.find("article")
        or soup.find("main")
        or soup.body
        or soup
    )

    markdown = html_to_markdown(str(root), heading_style="ATX", bullets="-")
    markdown = _normalize_markdown(markdown)
    if not markdown:
        fallback_text = _normalize_text(root.get_text("\n", strip=True))
        markdown = fallback_text
    return title, markdown


def _extract_title(soup: BeautifulSoup) -> str | None:
    candidates = [
        soup.find("meta", property="og:title"),
        soup.find("meta", attrs={"name": "twitter:title"}),
    ]
    for meta in candidates:
        if meta and meta.get("content"):
            return meta["content"].strip()[:TITLE_MAX]

    for tag in ("h1", "title"):
        node = soup.find(tag)
        if node:
            text = node.get_text(" ", strip=True)
            if text:
                return text[:TITLE_MAX]
    return None


def _build_result(title: str, content: str, source_type: str, source_url: str | None = None) -> dict[str, Any]:
    clean_title = _normalize_text(title)[:TITLE_MAX] or "Imported Draft"
    clean_content = content.strip()
    summary = _build_summary(clean_content)
    return {
        "title": clean_title,
        "slug": _slugify(clean_title),
        "summary": summary,
        "content": clean_content,
        "tags": [],
        "cover_url": None,
        "published": False,
        "reading_time": max(1, len(clean_content) // 1000) if clean_content else 1,
        "source_type": source_type,
        "source_url": source_url,
    }


def _normalize_markdown(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _build_summary(content: str) -> str:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return ""
    first = lines[0]
    if len(first) > SUMMARY_MAX:
        return first[: SUMMARY_MAX - 1] + "…"
    joined = _normalize_text(" ".join(lines[:3]))
    if len(joined) > SUMMARY_MAX:
        return joined[: SUMMARY_MAX - 1] + "…"
    return joined


def _title_from_filename(filename: str) -> str:
    stem = filename.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    stem = unquote(stem).replace("_", " ").replace("-", " ").strip()
    return stem or "Imported Draft"


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", text.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:80] or "imported-draft"


def _filename_from_url(url: str) -> str | None:
    path = urlparse(url).path.strip("/")
    if not path:
      return None
    return unquote(path.split("/")[-1])


def _filename_from_disposition(content_disposition: str) -> str | None:
    match = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', content_disposition)
    if not match:
        return None
    return unquote(match.group(1))


def _url_source_type(url: str) -> str:
    lower = url.lower()
    if "feishu" in lower or "larksuite" in lower:
        return "feishu"
    if "notion" in lower:
        return "notion"
    return "html"
