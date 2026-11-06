#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CFD Wiki 静态站点生成器
======================

设计目标
--------
* 零框架依赖：只需要 Python + Markdown + PyYAML + Jinja2 + Pygments。
* 自动发现内容：每个章节目录下的 `_chapter.json` 定义章节，目录内的
  `*.md` 自动成为页面，无需维护中央导航表。
* 内容增强：LaTeX 公式（MathJax）、代码高亮（Pygments）、Mermaid 图、
  `:::note` 提示块、`[[页面]]` 站内链接。
* 输出：`site/` 下的静态 HTML，可直接部署到 GitHub Pages / 任意静态托管。

用法
----
    python build.py              # 构建站点
    python build.py --serve      # 构建并启动本地预览（默认 8765 端口）
    python build.py --clean      # 先清空 site/ 再构建
"""

from __future__ import annotations

import argparse
import functools
import html
import json
import re
import shutil
import socketserver
import threading
import time
import uuid
import warnings
import webbrowser
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, datetime
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import papers_fetch

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.toc import TocExtension
from pygments.formatters import HtmlFormatter

ROOT = Path(__file__).resolve().parent
CONTENT_DIR = ROOT / "content"
TEMPLATE_DIR = ROOT / "templates"
ASSET_DIR = ROOT / "assets"
SITE_DIR = ROOT / "site"
LIBRARY_DIR = ROOT / "library"

BUILD_DATE = date.today().isoformat()
ADMONITION_TYPES = ("note", "tip", "warning", "danger", "info")
ADMONITION_TITLES = {
    "note": "说明",
    "tip": "提示",
    "warning": "注意",
    "danger": "警告",
    "info": "信息",
}

WARNINGS: list[str] = []


def warn(message: str) -> None:
    WARNINGS.append(message)
    print(f"  [warn] {message}")


# ---------------------------------------------------------------------------
# 基础解析
# ---------------------------------------------------------------------------

FRONT_MATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n", re.S)
CODE_FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})(.*)$")


def split_front_matter(text: str, source: Path) -> tuple[dict[str, Any], str]:
    """拆分 YAML front matter。"""
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return {}, text
    try:
        meta = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError as exc:
        warn(f"{source.relative_to(ROOT)} 的 front matter 解析失败：{exc}")
        return {}, text[match.end():]
    if not isinstance(meta, dict):
        warn(f"{source.relative_to(ROOT)} 的 front matter 必须是键值对。")
        meta = {}
    return meta, text[match.end():]


def iter_code_segments(text: str):
    """把文本拆成 (是否为代码段, 内容) 序列。

    代码段包含 ``` / ~~~ 围栏代码以及行内 `code`，这些区域内的 LaTeX
    标记、短代码、站内链接都不应该被解析。
    """
    lines = text.split("\n")
    buffer: list[str] = []
    in_fence = False
    fence_char = ""
    fence_len = 0

    def flush() -> None:
        if buffer:
            yield False, "\n".join(buffer)
            buffer.clear()

    for line in lines:
        fence = CODE_FENCE_RE.match(line)
        if not in_fence and fence:
            yield from flush()
            in_fence = True
            fence_char = fence.group(2)[0]
            fence_len = len(fence.group(2))
            buffer.append(line)
            continue
        if in_fence:
            buffer.append(line)
            closing = re.match(rf"^\s*\{fence_char}{{{fence_len},}}\s*$", line)
            if closing:
                yield True, "\n".join(buffer)
                buffer.clear()
                in_fence = False
            continue
        buffer.append(line)
    if in_fence:
        # 未闭合的围栏，按代码处理
        yield True, "\n".join(buffer)
        buffer.clear()
    else:
        yield from flush()


INLINE_CODE_RE = re.compile(r"(`[^`\n]+`)")


def transform_outside_code(text: str, func) -> str:
    """仅对非代码区域应用变换（行内代码也视为代码）。"""
    result: list[str] = []
    for is_code, segment in iter_code_segments(text):
        if is_code:
            result.append(segment)
        else:
            result.append("".join(
                part if part.startswith("`") else func(part)
                for part in INLINE_CODE_RE.split(segment)
            ))
    return "\n".join(result)


# ---------------------------------------------------------------------------
# Markdown 增强：公式、短代码、站内链接、Mermaid
# ---------------------------------------------------------------------------

MATH_INLINE_RE = re.compile(r"\$(?!\$)([^$\n]+?)\$")
MATH_DISPLAY_RE = re.compile(r"\$\$(.+?)\$\$", re.S)
DOLLAR_SENTINEL = "@@DOLLAR@@"


class RenderContext:
    """一次页面渲染所需的共享信息。"""

    def __init__(self, pages_by_key: dict[str, dict], root_prefix: str):
        self.pages_by_key = pages_by_key
        self.root_prefix = root_prefix
        self.math_inline: list[str] = []
        self.math_display: list[str] = []
        self.admonitions: list[str] = []
        self.mermaid: list[str] = []
        self.has_mermaid = False

    # -- 公式 -------------------------------------------------------------
    def protect_math(self, text: str) -> str:
        def replace_display(match: re.Match) -> str:
            self.math_display.append(match.group(1).strip())
            return f"\n\n@@MATHD{len(self.math_display) - 1}@@\n\n"

        def replace_inline(match: re.Match) -> str:
            self.math_inline.append(match.group(1).strip())
            return f"@@MATHI{len(self.math_inline) - 1}@@"

        text = text.replace("\\$", DOLLAR_SENTINEL)
        text = MATH_DISPLAY_RE.sub(replace_display, text)
        text = MATH_INLINE_RE.sub(replace_inline, text)
        return text

    def restore_math(self, html_text: str) -> str:
        for index, content in enumerate(self.math_display):
            block = f'<div class="math-block">\\[{content}\\]</div>'
            html_text = html_text.replace(f"<p>@@MATHD{index}@@</p>", block)
            html_text = html_text.replace(f"@@MATHD{index}@@", block)
        for index, content in enumerate(self.math_inline):
            html_text = html_text.replace(f"@@MATHI{index}@@", f"\\({content}\\)")
        return html_text.replace(DOLLAR_SENTINEL, "$")

    # -- Mermaid -----------------------------------------------------------
    def extract_mermaid(self, text: str) -> str:
        def repl(segment: str) -> str:
            lines = segment.split("\n")
            first = lines[0].strip()
            if not first.lower().startswith("```mermaid"):
                return segment
            body = "\n".join(lines[1:])
            body = re.sub(r"\n?```\s*$", "", body).strip("\n")
            self.has_mermaid = True
            self.mermaid.append(body)
            return f"\n\n@@MERMAID{len(self.mermaid) - 1}@@\n\n"

        return "\n".join(
            repl(segment) if is_code else segment
            for is_code, segment in iter_code_segments(text)
        )

    def restore_mermaid(self, html_text: str) -> str:
        for index, content in enumerate(self.mermaid):
            block = (
                '<div class="mermaid-figure"><pre class="mermaid">'
                f"{html.escape(content)}</pre></div>"
            )
            html_text = html_text.replace(f"<p>@@MERMAID{index}@@</p>", block)
            html_text = html_text.replace(f"@@MERMAID{index}@@", block)
        return html_text

    # -- 站内链接 -----------------------------------------------------------
    def resolve_wikilinks(self, text: str) -> str:
        def repl(segment: str) -> str:
            def inner(match: re.Match) -> str:
                raw = match.group(1).strip()
                if "|" in raw:
                    target, label = raw.split("|", 1)
                else:
                    target, label = raw, ""
                target = target.strip().strip("/")
                if target.endswith(".md"):
                    target = target[:-3]
                page = self.pages_by_key.get(target)
                if page is None:
                    warn(f"站内链接目标不存在：[[{raw}]]")
                    return f'<span class="broken-link" title="页面不存在">[[{raw}]]</span>'
                text_label = label or page["title"]
                return (
                    f'<a class="wiki-link" href="{self.root_prefix}{page["url"]}">'
                    f"{text_label}</a>"
                )

            return re.sub(r"\[\[([^\]]+)\]\]", inner, segment)

        return transform_outside_code(text, repl)

    # -- 提示块 -------------------------------------------------------------
    def expand_admonitions(self, text: str) -> str:
        lines = text.split("\n")
        out: list[str] = []
        index = 0
        while index < len(lines):
            match = re.match(
                rf"^:::({'|'.join(ADMONITION_TYPES)})(?:\s+(.*))?$", lines[index].strip()
            )
            if not match:
                out.append(lines[index])
                index += 1
                continue
            kind = match.group(1)
            title = (match.group(2) or ADMONITION_TITLES[kind]).strip()
            body: list[str] = []
            treated_as_line = index + 1
            while treated_as_line < len(lines) and lines[treated_as_line].strip() != ":::":
                body.append(lines[treated_as_line])
                treated_as_line += 1
            if treated_as_line >= len(lines):
                warn("存在未闭合的 ::: 提示块。")
            inner_md = "\n".join(body).strip("\n")
            inner_ctx = RenderContext(self.pages_by_key, self.root_prefix)
            inner_ctx.math_inline = self.math_inline
            inner_ctx.math_display = self.math_display
            inner_ctx.mermaid = self.mermaid
            inner_ctx.has_mermaid = self.has_mermaid
            inner_md = inner_ctx.extract_mermaid(inner_md)
            inner_md = inner_ctx.resolve_wikilinks(inner_md)
            inner_html = render_markdown(inner_md, toc=False)
            inner_ctx.has_mermaid and setattr(self, "has_mermaid", True)

            self.admonitions.append(
                f'<div class="admonition {kind}">'
                f'<div class="admonition-title">{html.escape(title)}</div>'
                f'<div class="admonition-body">{inner_html}</div>'
                "</div>"
            )
            out.append(f"\n@@ADM{len(self.admonitions) - 1}@@\n")
            index = treated_as_line + 1
        return "\n".join(out)

    def restore_admonitions(self, html_text: str) -> str:
        for index, content in enumerate(self.admonitions):
            html_text = html_text.replace(f"<p>@@ADM{index}@@</p>", content)
            html_text = html_text.replace(f"@@ADM{index}@@", content)
        return html_text


def slugify(value: str, separator: str = "-") -> str:
    """标题锚点：保留中文、字母、数字，空格转连字符。"""
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value).strip().lower()
    value = re.sub(r"[^\w\u4e00-\u9fff\- ]+", "", value, flags=re.UNICODE)
    value = re.sub(r"\s+", separator, value)
    return value.strip(separator) or "section"


def render_markdown(text: str, toc: bool = True) -> str:
    extensions = [
        "tables",
        "fenced_code",
        "sane_lists",
        CodeHiliteExtension(css_class="codehilite", guess_lang=False, linenums=False),
    ]
    if toc:
        extensions.append(TocExtension(toc_depth="2-3", permalink=False, slugify=slugify))
    return markdown.Markdown(extensions=extensions).convert(text)


def render_body(markdown_text: str, ctx: RenderContext) -> tuple[str, str]:
    """把 Markdown 源文本渲染为 HTML 与目录。"""
    body = ctx.protect_math(markdown_text)
    body = ctx.extract_mermaid(body)
    body = ctx.expand_admonitions(body)
    body = ctx.resolve_wikilinks(body)

    md = markdown.Markdown(
        extensions=[
            "tables",
            "fenced_code",
            "sane_lists",
            CodeHiliteExtension(css_class="codehilite", guess_lang=False, linenums=False),
            TocExtension(toc_depth="2-3", permalink=False, slugify=slugify),
        ]
    )
    html_body = md.convert(body)
    toc_html = md.toc or ""
    # Python-Markdown 会在 md.toc 外包一层 <div class="toc">，
    # 它会与页面右侧目录的 .toc 类冲突，这里去掉外壳。
    if toc_html.startswith('<div class="toc">'):
        toc_html = toc_html[len('<div class="toc">'):]
        if toc_html.rstrip().endswith("</div>"):
            toc_html = toc_html.rstrip()[:-len("</div>")]

    html_body = ctx.restore_admonitions(html_body)
    html_body = ctx.restore_mermaid(html_body)
    html_body = ctx.restore_math(html_body)
    return html_body, toc_html


# ---------------------------------------------------------------------------
# 内容发现
# ---------------------------------------------------------------------------


def load_site_meta() -> dict[str, Any]:
    config_path = ROOT / "wiki.json"
    if not config_path.exists():
        return {"title": "CFD Wiki", "description": "计算流体力学知识库"}
    with config_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_chapters(site_meta: dict[str, Any]) -> list[dict[str, Any]]:
    chapters: list[dict[str, Any]] = []
    for directory in sorted(CONTENT_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not directory.is_dir() or directory.name.startswith(("_", ".")):
            continue
        config_path = directory / "_chapter.json"
        if not config_path.exists():
            warn(f"目录 content/{directory.name} 缺少 _chapter.json，已跳过。")
            continue
        with config_path.open("r", encoding="utf-8") as handle:
            chapter_meta = json.load(handle)

        pages: list[dict[str, Any]] = []
        for source in sorted(directory.glob("*.md")):
            if source.name.startswith("."):
                continue
            raw = source.read_text(encoding="utf-8")
            meta, body = split_front_matter(raw, source)
            if meta.get("draft") is True:
                continue
            stem = source.stem
            is_index = stem in {"index", "_index"}
            url = (
                f"{directory.name}/{stem}.html"
                if not is_index
                else f"{directory.name}/index.html"
            )
            page = {
                "id": f"{directory.name}/{stem}",
                "chapter_id": directory.name,
                "stem": stem,
                "title": str(meta.get("title") or stem.replace("-", " ").title()),
                "order": int(meta.get("order", 10_000 if not is_index else -1)),
                "summary": str(meta.get("summary") or "").strip(),
                "tags": list(meta.get("tags") or []),
                "layout": str(meta.get("layout") or "page"),
                "url": url,
                "body": body,
                "source": source,
                "is_index": is_index,
                "chapter": None,
            }
            pages.append(page)

        if not pages:
            warn(f"章节 {directory.name} 没有页面。")
            continue

        chapter = {
            "id": directory.name,
            "title": chapter_meta.get("title", directory.name),
            "subtitle": chapter_meta.get("subtitle", ""),
            "summary": chapter_meta.get("summary", ""),
            "order": int(chapter_meta.get("order", 10_000)),
            "number": str(chapter_meta.get("number", "")),
            "kind": str(chapter_meta.get("kind") or "docs"),
            "pages": [],
            "index": None,
        }
        pages.sort(key=lambda item: (0 if item["is_index"] else 1, item["order"], item["stem"]))
        chapter["pages"] = pages
        chapter["index"] = next((p for p in pages if p["is_index"]), None)
        for page in pages:
            page["chapter"] = chapter
        chapters.append(chapter)

    chapters.sort(key=lambda item: (item["order"], item["id"]))
    return chapters


def build_page_index(chapters: list[dict[str, Any]]) -> dict[str, dict]:
    index: dict[str, dict] = {}
    bare: dict[str, list[dict]] = {}
    for chapter in chapters:
        for page in chapter["pages"]:
            index[page["id"]] = page
            bare.setdefault(page["stem"], []).append(page)
        if chapter["index"] is not None:
            # 允许 [[ch1]] 直接指向章节首页
            index.setdefault(chapter["id"], chapter["index"])
    for stem, pages in bare.items():
        if len(pages) == 1:
            index.setdefault(stem, pages[0])
    return index


def load_home_page() -> dict[str, Any]:
    source = CONTENT_DIR / "index.md"
    if not source.exists():
        warn("缺少 content/index.md，使用默认首页。")
        return {
            "id": "index",
            "chapter_id": "",
            "stem": "index",
            "title": "CFD Wiki",
            "summary": "",
            "tags": [],
            "url": "index.html",
            "body": "",
            "source": source,
            "is_index": True,
            "chapter": {"title": "首页", "number": "", "order": 0, "pages": []},
        }
    raw = source.read_text(encoding="utf-8")
    meta, body = split_front_matter(raw, source)
    return {
        "id": "index",
        "chapter_id": "",
        "stem": "index",
        "title": str(meta.get("title") or "首页"),
        "summary": str(meta.get("summary") or ""),
        "tags": list(meta.get("tags") or []),
        "url": "index.html",
        "body": body,
        "source": source,
        "is_index": True,
        "chapter": {"title": "首页", "number": "", "order": 0, "pages": []},
    }


# ---------------------------------------------------------------------------
# 页面构建
# ---------------------------------------------------------------------------


def root_prefix_for(url: str) -> str:
    depth = len([part for part in url.split("/") if part]) - 1
    return "../" * depth


def count_words(text: str) -> int:
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    english = len(re.findall(r"[A-Za-z]+", text))
    return chinese + english


def plain_text(fragment: str) -> str:
    fragment = re.sub(r"<script[\s\S]*?</script>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<style[\s\S]*?</style>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = html.unescape(fragment)
    return re.sub(r"\s+", " ", fragment).strip()


def render_nav(
    chapters: list[dict],
    current_page: dict | None,
    root: str,
    active_home: bool = False,
) -> str:
    def page_link(page: dict) -> str:
        active = current_page is not None and page["id"] == current_page["id"]
        classes = "nav-link" + (" is-active" if active else "")
        return (
            f'<li><a class="{classes}" href="{root}{page["url"]}">'
            f"{html.escape(page['title'])}</a></li>"
        )

    home_block = (
        f'<a class="nav-home{" is-active" if active_home else ""}" href="{root}index.html">'
        '<span class="nav-home-icon">◧</span>首页总览</a>'
    )

    def chapter_html(chapter: dict) -> str:
        index_page = chapter["index"]
        heading_href = f'{root}{index_page["url"]}' if index_page else f'{root}index.html'
        chapter_active = current_page is not None and current_page["chapter_id"] == chapter["id"]
        badge = html.escape(chapter["number"] or "LIB")
        return (
            '<div class="nav-chapter">'
            f'<a class="nav-chapter-title{" is-active" if chapter_active else ""}" '
            f'href="{heading_href}">'
            f'<span class="nav-badge">{badge}</span>'
            f'<span class="nav-chapter-name">{html.escape(chapter["title"])}</span>'
            "</a>"
            '<ul class="nav-pages">'
            + "".join(page_link(page) for page in chapter["pages"] if not page["is_index"])
            + "</ul></div>"
        )

    def module_html(key: str, label: str, group: list[dict]) -> str:
        if not group:
            return ""
        active = current_page is not None and any(
            current_page["chapter_id"] == chapter["id"] for chapter in group
        )
        count = len(group)
        return (
            f'<div class="nav-module" data-module="{key}">'
            f'<button class="nav-module-head{" is-active" if active else ""}" type="button" '
            f'data-module-toggle="{key}" aria-expanded="true">'
            f'<span class="nav-module-label">{label}</span>'
            f'<span class="nav-module-count">{count}</span>'
            '<svg class="nav-module-arrow" viewBox="0 0 24 24" width="14" height="14" '
            'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
            '<path d="m7 10 5 5 5-5"/></svg>'
            "</button>"
            f'<div class="nav-module-body" data-module-body="{key}">'
            + "".join(chapter_html(chapter) for chapter in group)
            + "</div></div>"
        )

    docs = [chapter for chapter in chapters if chapter["kind"] != "library"]
    library = [chapter for chapter in chapters if chapter["kind"] == "library"]
    return "\n".join(
        [
            home_block,
            module_html("docs", "基础知识", docs),
            module_html("library", "阅读文献", library),
        ]
    )


def search_entry(page: dict, body_html: str) -> dict[str, Any]:
    chapter = page.get("chapter") or {}
    text = re.sub(r"\\\(.*?\\\)|\\\[.*?\\\]", " ", plain_text(body_html), flags=re.S)
    text = re.sub(r"\s+", " ", text).strip()
    return {
        "t": page["title"],
        "u": page["url"],
        "c": chapter.get("title", "首页"),
        "n": chapter.get("number", ""),
        "s": page.get("summary", ""),
        "g": page.get("tags", []),
        "x": text[:6000],
    }


# ---------------------------------------------------------------------------
# 论文与书籍分区
# ---------------------------------------------------------------------------

LIBRARY_EXTENSIONS = {".pdf", ".docx", ".html", ".htm", ".ppt", ".pptx"}
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def load_library() -> list[dict[str, Any]]:
    """读取 library/manifest.json，返回按上传时间倒序的文献列表。"""
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    (LIBRARY_DIR / "files").mkdir(exist_ok=True)
    (LIBRARY_DIR / "previews").mkdir(exist_ok=True)
    path = LIBRARY_DIR / "manifest.json"
    if not path.exists():
        path.write_text("[]", encoding="utf-8")
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        warn("library/manifest.json 无法解析，本次按空列表处理。")
        return []
    items = [item for item in data if isinstance(item, dict) and item.get("file")]
    items.sort(key=lambda item: str(item.get("added", "")), reverse=True)
    return items


def save_library(items: list[dict[str, Any]]) -> None:
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    (LIBRARY_DIR / "manifest.json").write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ---- 章节参考文档（每章可附加 PDF / DOCX / PPT，供浏览与下载）---------
REFS_DIR = LIBRARY_DIR / "refs"
REFS_FILES_DIR = REFS_DIR / "files"
REFS_PREVIEWS_DIR = REFS_DIR / "previews"
REF_EXTENSIONS = {".pdf", ".docx", ".html", ".htm", ".ppt", ".pptx"}


def load_refs(chapter_id: str) -> list[dict[str, Any]]:
    """读取某章节的参考文档列表（无则返回空）。"""
    if not chapter_id:
        return []
    REFS_DIR.mkdir(parents=True, exist_ok=True)
    path = REFS_DIR / f"{chapter_id}.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    items = [item for item in data if isinstance(item, dict) and item.get("file")]
    items.sort(key=lambda item: str(item.get("added", "")), reverse=True)
    return items


def save_refs(chapter_id: str, items: list[dict[str, Any]]) -> None:
    REFS_DIR.mkdir(parents=True, exist_ok=True)
    (REFS_DIR / f"{chapter_id}.json").write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def docx_paragraph_text(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        if node.tag == W_NS + "t" and node.text:
            parts.append(node.text)
        elif node.tag == W_NS + "tab":
            parts.append("\t")
        elif node.tag == W_NS + "br":
            parts.append(" ")
    return "".join(parts).strip()


def docx_to_html(path: Path) -> str:
    """用标准库把 .docx 转成可在线阅读的简单 HTML（段落、标题、表格）。"""
    with zipfile.ZipFile(path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    body = document.find(W_NS + "body")
    if body is None:
        return "<p>（空文档）</p>"
    blocks: list[str] = []
    for child in body:
        if child.tag == W_NS + "p":
            text = docx_paragraph_text(child)
            if not text:
                continue
            style_node = child.find(f"{W_NS}pPr/{W_NS}pStyle")
            style = style_node.get(W_NS + "val", "") if style_node is not None else ""
            lowered = style.lower()
            if "title" in lowered:
                blocks.append(f"<h1>{html.escape(text)}</h1>")
            elif "heading" in lowered or "标题" in style:
                digits = re.sub(r"\D", "", style)
                level = digits if digits in {"1", "2", "3", "4", "5", "6"} else "2"
                blocks.append(f"<h{level}>{html.escape(text)}</h{level}>")
            else:
                blocks.append(f"<p>{html.escape(text)}</p>")
        elif child.tag == W_NS + "tbl":
            rows: list[str] = []
            for row in child.findall(W_NS + "tr"):
                cells = [
                    "".join(node.text or "" for node in cell.iter(W_NS + "t"))
                    for cell in row.findall(W_NS + "tc")
                ]
                rows.append(
                    "<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in cells) + "</tr>"
                )
            if rows:
                blocks.append(
                    '<table class="docx-table">' + "".join(rows) + "</table>"
                )
    return "\n".join(blocks) or "<p>（空文档）</p>"


def library_view(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """补充展示字段：文件大小、类型标签。"""
    view: list[dict[str, Any]] = []
    for item in items:
        size = int(item.get("size") or 0)
        if size >= 1024 * 1024:
            size_label = f"{size / 1024 / 1024:.1f} MB"
        else:
            size_label = f"{max(1, size // 1024)} KB"
        view.append(
            {
                **item,
                "size_label": size_label,
                "kind_label": str(item.get("kind") or "file").upper(),
            }
        )
    return view


def docs_page_count(all_pages: list[dict[str, Any]], chapters: list[dict[str, Any]]) -> int:
    library_ids = {chapter["id"] for chapter in chapters if chapter["kind"] == "library"}
    return sum(1 for page in all_pages if page["chapter_id"] not in library_ids)


def build() -> None:
    site_meta = load_site_meta()
    chapters = load_chapters(site_meta)
    page_index = build_page_index(chapters)
    home_page = load_home_page()
    all_pages = [page for chapter in chapters for page in chapter["pages"]]
    ordered_pages = sorted(
        all_pages,
        key=lambda p: (
            p["chapter"]["order"],
            0 if p["is_index"] else 1,
            p["order"],
            p["stem"],
        ),
    )
    total_words = sum(count_words(page["body"]) for page in all_pages)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )

    if SITE_DIR.exists():
        shutil.rmtree(SITE_DIR, ignore_errors=True)
    SITE_DIR.mkdir(parents=True, exist_ok=True)

    # 静态资源
    shutil.copytree(ASSET_DIR, SITE_DIR / "assets", dirs_exist_ok=True)
    pygments_css = (
        HtmlFormatter(style="friendly").get_style_defs(".codehilite")
        + "\n"
        + HtmlFormatter(style="one-dark").get_style_defs("[data-theme='dark'] .codehilite")
    )
    (SITE_DIR / "assets" / "css" / "pygments.css").write_text(
        pygments_css, encoding="utf-8"
    )

    # ---- 论文与书籍（library/）-----------------------------------------
    library_items = load_library()
    library_site = SITE_DIR / "library"
    library_site.mkdir(parents=True, exist_ok=True)
    shutil.copytree(LIBRARY_DIR / "files", library_site / "files", dirs_exist_ok=True)
    shutil.copytree(
        LIBRARY_DIR / "previews", library_site / "previews", dirs_exist_ok=True
    )
    (library_site / "manifest.json").write_text(
        json.dumps(library_items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (SITE_DIR / "library-index.js").write_text(
        "window.__LIBRARY__="
        + json.dumps(library_items, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    # ---- 章节参考文档（复制文件并注入索引，供 file:// 直开）------------
    if REFS_FILES_DIR.exists():
        shutil.copytree(REFS_FILES_DIR, library_site / "refs" / "files", dirs_exist_ok=True)
    if REFS_PREVIEWS_DIR.exists():
        shutil.copytree(REFS_PREVIEWS_DIR, library_site / "refs" / "previews", dirs_exist_ok=True)
    refs_index: dict[str, list[dict[str, Any]]] = {}
    if REFS_DIR.exists():
        for meta_file in REFS_DIR.glob("*.json"):
            chapter_id = meta_file.stem
            refs_index[chapter_id] = load_refs(chapter_id)
    (SITE_DIR / "library-refs.js").write_text(
        "window.__REFS__="
        + json.dumps(refs_index, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    # ---- 文献检索结果（近 1 年 AI4Science / 神经算子）------------------
    papers = papers_fetch.load_papers()
    papers_state = papers_fetch.load_state()
    papers_meta = {
        "keywords": papers_fetch.load_keywords(),
        "last_manual_at": papers_state.get("last_manual_at", ""),
        "last_auto_at": papers_state.get("last_auto_at", ""),
        "total": len(papers),
    }
    (SITE_DIR / "library-papers.js").write_text(
        "window.__PAPERS__="
        + json.dumps(papers, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.__PAPERS_META__="
        + json.dumps(papers_meta, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    # ---- 每周自动任务（独立关键词/结果/状态）---------------------------
    weekly_papers = papers_fetch.load_weekly_papers()
    weekly_meta = papers_fetch.weekly_snapshot()
    (SITE_DIR / "library-weekly-papers.js").write_text(
        "window.__WEEKLY_PAPERS__="
        + json.dumps(weekly_papers, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.__WEEKLY_META__="
        + json.dumps(weekly_meta, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    search_entries: list[dict[str, Any]] = []

    # ---- 首页 ---------------------------------------------------------
    home_ctx = RenderContext(page_index, "")
    home_body, _ = render_body(home_page["body"], home_ctx)
    home_html = env.get_template("home.html").render(
        site=site_meta,
        page=home_page,
        chapters=chapters,
        chapter=None,
        chapter_pages=[],
        nav_html=render_nav(chapters, None, "", active_home=True),
        root="",
        body=home_body,
        toc="",
        has_toc=False,
        prev=None,
        next=None,
        breadcrumbs=[],
        build_date=BUILD_DATE,
        word_count=count_words(home_page["body"]),
        has_mermaid=home_ctx.has_mermaid,
        is_home=True,
        is_chapter_index=False,
        all_pages=all_pages,
        page_index=page_index,
        stats={
            "chapters": sum(1 for chapter in chapters if chapter["kind"] == "docs"),
            "pages": docs_page_count(all_pages, chapters),
            "words": total_words,
        },
    )
    (SITE_DIR / "index.html").write_text(home_html, encoding="utf-8")
    search_entries.append(search_entry(home_page, home_body))
    print("  built index.html")

    # ---- 章节页面 -----------------------------------------------------
    for order_index, page in enumerate(ordered_pages):
        root = root_prefix_for(page["url"])
        chapter = page["chapter"]
        ctx = RenderContext(page_index, root)
        body_html, toc_html = render_body(page["body"], ctx)
        previous_page = ordered_pages[order_index - 1] if order_index > 0 else None
        next_page = (
            ordered_pages[order_index + 1] if order_index + 1 < len(ordered_pages) else None
        )
        is_chapter_index = page["is_index"]
        chapter_pages = [p for p in chapter["pages"] if not p["is_index"]]

        breadcrumbs = [{"title": "首页", "url": f"{root}index.html"}]
        if chapter["index"]:
            breadcrumbs.append(
                {
                    "title": chapter["title"],
                    "url": f'{root}{chapter["index"]["url"]}',
                }
            )
        if not is_chapter_index:
            breadcrumbs.append({"title": page["title"], "url": None})

        context = {
            "site": site_meta,
            "page": page,
            "chapters": chapters,
            "chapter": chapter,
            "chapter_pages": chapter_pages,
            "nav_html": render_nav(chapters, page, root),
            "root": root,
            "body": body_html,
            "toc": toc_html,
            "has_toc": bool(toc_html),
            "prev": previous_page,
            "next": next_page,
            "breadcrumbs": breadcrumbs,
            "build_date": BUILD_DATE,
            "word_count": count_words(page["body"]),
            "has_mermaid": ctx.has_mermaid,
            "is_home": False,
            "is_chapter_index": is_chapter_index,
            "chapter_id": chapter["id"],
            "show_refs": chapter["kind"] == "docs",
            "all_pages": all_pages,
            "page_index": page_index,
            "stats": {
                "chapters": sum(
                    1 for item in chapters if item["kind"] == "docs"
                ),
                "pages": docs_page_count(all_pages, chapters),
                "words": total_words,
            },
            "library_items": library_view(library_items),
        }

        template_name = "library.html" if chapter["kind"] == "library" else "page.html"
        html_output = env.get_template(template_name).render(**context)
        target = SITE_DIR / page["url"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html_output, encoding="utf-8")

        search_entries.append(search_entry(page, body_html))
        print(f"  built {page['url']}")

    search_index = json.dumps(search_entries, ensure_ascii=False, separators=(",", ":"))
    (SITE_DIR / "search-index.js").write_text(
        "window.__CFD_SEARCH_INDEX=" + search_index + ";\n", encoding="utf-8"
    )

    # 简单的 404 页面
    not_found = env.get_template("404.html").render(
        site=site_meta, build_date=BUILD_DATE, root=""
    )
    (SITE_DIR / "404.html").write_text(not_found, encoding="utf-8")

    # ---- 文献阅读器 -----------------------------------------------------
    viewer_html = env.get_template("viewer.html").render(
        site=site_meta, build_date=BUILD_DATE, root=""
    )
    (library_site / "viewer.html").write_text(viewer_html, encoding="utf-8")

    # ---- 按关键词查看全部文献 -------------------------------------------
    papers_html = env.get_template("papers.html").render(
        site=site_meta, build_date=BUILD_DATE, root=""
    )
    (library_site / "papers.html").write_text(papers_html, encoding="utf-8")

    print()
    print(f"完成：{1 + len(ordered_pages)} 个页面 -> {SITE_DIR}")
    if WARNINGS:
        print(f"共 {len(WARNINGS)} 条警告：")
    else:
        print("没有警告。")


class WikiRequestHandler(SimpleHTTPRequestHandler):
    """本地预览服务：静态文件 + 文献上传接口。"""

    server_version = "CFDWiki/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault("directory", str(SITE_DIR))
        super().__init__(*args, **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        pass

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/library":
            self.send_json(load_library())
            return
        if path == "/api/papers":
            self.send_json(papers_fetch.load_papers())
            return
        if path == "/api/papers-meta":
            self.send_json(papers_fetch.state_snapshot())
            return
        if path == "/api/papers-weekly":
            self.send_json(papers_fetch.load_weekly_papers())
            return
        if path == "/api/papers-weekly-meta":
            self.send_json(papers_fetch.weekly_snapshot())
            return
        if path == "/api/refs":
            query = urlparse(self.path).query
            chapter_id = self._query_param(query, "chapter")
            self.send_json(load_refs(chapter_id))
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/upload":
            self.handle_upload()
        elif path == "/api/fetch-papers":
            self.handle_fetch_papers()
        elif path == "/api/fetch-weekly":
            self.handle_fetch_weekly()
        elif path == "/api/upload-ref":
            self.handle_upload_ref()
        else:
            self.send_json({"error": "未知接口"}, 404)

    @staticmethod
    def _query_param(query: str, key: str) -> str:
        for part in query.split("&"):
            if part.startswith(key + "="):
                return unquote(part[len(key) + 1 :])
        return ""

    def handle_fetch_weekly(self) -> None:
        """每周任务：手动触发近两周检索，写入独立 weekly 存储。"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:
            body = {}
        keywords = body.get("keywords")
        if not isinstance(keywords, list) or not keywords:
            keywords = papers_fetch.load_weekly_keywords()
        try:
            days = int(body.get("days", 14))
        except (TypeError, ValueError):
            days = 14
        days = min(max(days, 7), 30)
        try:
            result = papers_fetch.run_weekly_fetch(keywords, days)
        except Exception as exc:  # noqa: BLE001
            self.send_json({"error": f"检索失败：{exc}"}, 500)
            return
        _write_weekly_script(result["papers"])
        self.send_json(result)

    def handle_fetch_papers(self) -> None:
        """任务一：手动触发近 1 年文献检索。"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:
            body = {}
        keywords = body.get("keywords")
        if not isinstance(keywords, list) or not keywords:
            keywords = papers_fetch.load_keywords()
        try:
            days = int(body.get("days", 365))
        except (TypeError, ValueError):
            days = 365
        days = min(max(days, 7), 730)
        try:
            result = papers_fetch.run_fetch_and_store(keywords, days, trigger="manual")
        except Exception as exc:  # noqa: BLE001
            self.send_json({"error": f"检索失败：{exc}"}, 500)
            return
        # 同步注入 site/，刷新页面即可看到最新结果
        _write_papers_script(result["papers"])
        self.send_json(result)

    def handle_upload(self) -> None:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self.send_json({"error": "文件为空"}, 400)
            return
        if length > 200 * 1024 * 1024:
            self.send_json({"error": "文件超过 200 MB 上限"}, 413)
            return

        filename = unquote(self.headers.get("X-Filename", "")).strip()
        suffix = Path(filename).suffix.lower()
        if suffix not in LIBRARY_EXTENSIONS:
            self.send_json({"error": "仅支持 PDF / DOCX / HTML / PPT"}, 400)
            return

        payload = self.rfile.read(length)
        ident = uuid.uuid4().hex[:12]
        stored_name = ident + (".html" if suffix == ".htm" else suffix)
        target = LIBRARY_DIR / "files" / stored_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)

        preview = ""
        if suffix == ".docx":
            try:
                preview_name = ident + ".html"
                (LIBRARY_DIR / "previews" / preview_name).write_text(
                    docx_to_html(target), encoding="utf-8"
                )
                preview = f"previews/{preview_name}"
            except Exception:
                preview = ""

        entry = {
            "id": ident,
            "title": unquote(self.headers.get("X-Title", "")).strip()
            or Path(filename).stem,
            "authors": unquote(self.headers.get("X-Authors", "")).strip(),
            "year": unquote(self.headers.get("X-Year", "")).strip(),
            "kind": suffix.lstrip("."),
            "file": f"files/{stored_name}",
            "preview": preview,
            "size": len(payload),
            "added": datetime.now().isoformat(timespec="seconds"),
        }
        items = load_library()
        items.insert(0, entry)
        save_library(items)

        # 立即同步到 site/，刷新页面即可看到新条目
        shutil.copy2(target, SITE_DIR / "library" / "files" / stored_name)
        if preview:
            shutil.copy2(
                LIBRARY_DIR / "previews" / Path(preview).name,
                SITE_DIR / "library" / "previews" / Path(preview).name,
            )
        payload_json = json.dumps(items, ensure_ascii=False)
        (SITE_DIR / "library" / "manifest.json").write_text(
            json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (SITE_DIR / "library-index.js").write_text(
            "window.__LIBRARY__=" + payload_json + ";\n", encoding="utf-8"
        )

        self.send_json(entry)

    def handle_upload_ref(self) -> None:
        """为某章节上传参考文档（PDF / DOCX / PPT）。"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self.send_json({"error": "文件为空"}, 400)
            return
        if length > 200 * 1024 * 1024:
            self.send_json({"error": "文件超过 200 MB 上限"}, 413)
            return

        chapter_id = unquote(self.headers.get("X-Chapter", "")).strip()
        if not chapter_id:
            self.send_json({"error": "缺少章节标识"}, 400)
            return

        filename = unquote(self.headers.get("X-Filename", "")).strip()
        suffix = Path(filename).suffix.lower()
        if suffix not in REF_EXTENSIONS:
            self.send_json({"error": "仅支持 PDF / DOCX / HTML / PPT"}, 400)
            return

        payload = self.rfile.read(length)
        ident = uuid.uuid4().hex[:12]
        stored_name = ident + (".html" if suffix == ".htm" else suffix)
        target = REFS_FILES_DIR / stored_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)

        preview = ""
        if suffix == ".docx":
            try:
                preview_name = ident + ".html"
                REFS_PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
                (REFS_PREVIEWS_DIR / preview_name).write_text(
                    docx_to_html(target), encoding="utf-8"
                )
                preview = f"previews/{preview_name}"
            except Exception:
                preview = ""

        entry = {
            "id": ident,
            "title": unquote(self.headers.get("X-Title", "")).strip()
            or Path(filename).stem,
            "kind": suffix.lstrip("."),
            "file": f"files/{stored_name}",
            "preview": preview,
            "size": len(payload),
            "added": datetime.now().isoformat(timespec="seconds"),
        }
        items = load_refs(chapter_id)
        items.insert(0, entry)
        save_refs(chapter_id, items)

        # 立即同步到 site/ 供刷新查看
        shutil.copy2(target, SITE_DIR / "library" / "refs" / "files" / stored_name)
        if preview:
            shutil.copy2(
                REFS_PREVIEWS_DIR / Path(preview).name,
                SITE_DIR / "library" / "refs" / "previews" / Path(preview).name,
            )
        refs_index: dict[str, list[dict[str, Any]]] = {}
        for meta_file in REFS_DIR.glob("*.json"):
            refs_index[meta_file.stem] = load_refs(meta_file.stem)
        (SITE_DIR / "library-refs.js").write_text(
            "window.__REFS__="
            + json.dumps(refs_index, ensure_ascii=False, separators=(",", ":"))
            + ";\n",
            encoding="utf-8",
        )

        self.send_json(entry)


def _write_papers_script(papers: list[dict[str, Any]]) -> None:
    """把检索结果写成 site/library-papers.js，供 file:// 直开使用。"""
    state = papers_fetch.load_state()
    meta = {
        "keywords": papers_fetch.load_keywords(),
        "last_manual_at": state.get("last_manual_at", ""),
        "last_auto_at": state.get("last_auto_at", ""),
        "total": len(papers),
    }
    (SITE_DIR / "library-papers.js").write_text(
        "window.__PAPERS__="
        + json.dumps(papers, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.__PAPERS_META__="
        + json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def _write_weekly_script(papers: list[dict[str, Any]]) -> None:
    """把每周检索结果写成 site/library-weekly-papers.js。"""
    meta = papers_fetch.weekly_snapshot()
    (SITE_DIR / "library-weekly-papers.js").write_text(
        "window.__WEEKLY_PAPERS__="
        + json.dumps(papers, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.__WEEKLY_META__="
        + json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def _papers_scheduler_loop() -> None:
    """任务二：后台周调度线程。

    每分钟检查一次，检测到已跨入新的一周（以每周一为界）就自动检索
    「上两周」的最新文献；结果写回 weekly 存储与 site/ 脚本。
    """
    while True:
        try:
            result = papers_fetch.auto_fetch_if_due()
            if result:
                _write_weekly_script(result["papers"])
        except Exception:  # noqa: BLE001
            pass
        time.sleep(60)


def serve(port: int) -> None:
    threading.Thread(target=_papers_scheduler_loop, daemon=True).start()
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), WikiRequestHandler) as httpd:
        url = f"http://127.0.0.1:{port}/"
        print(f"预览地址：{url}  (Ctrl+C 停止)")
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        httpd.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="CFD Wiki 静态站点生成器")
    parser.add_argument("--serve", action="store_true", help="构建后启动本地预览")
    parser.add_argument("--port", type=int, default=8765, help="预览端口")
    parser.add_argument("--clean", action="store_true", help="构建前清空 site/")
    args = parser.parse_args()

    if args.clean and SITE_DIR.exists():
        shutil.rmtree(SITE_DIR, ignore_errors=True)
    build()
    if args.serve:
        serve(args.port)


if __name__ == "__main__":
    main()
