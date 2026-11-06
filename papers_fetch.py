#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CFD Wiki 文献检索引擎
======================

从 arXiv、期刊（PoF / JFM / JCP / Nature Communications / Nature Machine
Intelligence）以及顶会（NeurIPS / ICML / ICLR）检索「AI for Science（流体
力学）与神经算子」方向的近期论文。

数据源全部使用无需密钥的公开接口：

* arXiv       —— Atom API（export.arxiv.org）
* 期刊        —— Crossref REST API（api.crossref.org），按 ISSN 过滤
* 会议        —— OpenReview API（api2.openreview.net），按投稿 invitation 过滤

检索结果会：去重 → 依据关键词做分类（关键词命中标题/摘要）→ 生成内容简介
（摘要截断）→ 保存到 library/papers.json。手动触发与每周自动调度共用同一
个 ``fetch_all`` 入口，仅时间窗不同（手动近 1 年，周任务取上两周）。
"""

from __future__ import annotations

import hashlib
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
LIBRARY_DIR = ROOT / "library"

ARXIV_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_API = "http://export.arxiv.org/api/query"
CROSSREF_API = "https://api.crossref.org/works"
OPENREVIEW_API = "https://api2.openreview.net/notes/search"

# ---------------------------------------------------------------------------
# 来源配置
# ---------------------------------------------------------------------------

DEFAULT_KEYWORDS = [
    "neural operator",
    "Fourier neural operator",
    "DeepONet",
    "operator learning",
    "physics-informed neural network",
    "PINN",
    "scientific machine learning",
    "machine learning fluid dynamics",
    "machine learning turbulence",
    "turbulence closure",
    "AI for science",
    "data-driven turbulence modeling",
    "surrogate model",
    "neural surrogate",
    "neural PDE solver",
    "graph neural network",
    "foundation model",
    "diffusion model",
]

# 每周自动任务的独立关键词（与年度检索互不影响，可在前端单独增删）
DEFAULT_WEEKLY_KEYWORDS = [
    "neural operator",
    "Fourier neural operator",
    "DeepONet",
    "physics-informed neural network",
    "PINN",
    "machine learning fluid dynamics",
    "machine learning turbulence",
    "turbulence closure",
    "scientific machine learning",
    "data-driven turbulence modeling",
]

JOURNAL_SOURCES = [
    {"source": "Physics of Fluids", "label": "PoF", "issn": "1070-6631"},
    {"source": "Journal of Fluid Mechanics", "label": "JFM", "issn": "0022-1120"},
    {"source": "Journal of Computational Physics", "label": "JCP", "issn": "0021-9991"},
    {"source": "Nature Communications", "label": "Nat. Commun.", "issn": "2041-1723"},
    {
        "source": "Nature Machine Intelligence",
        "label": "Nat. Mach. Intell.",
        "issn": "2522-5839",
    },
]

CONF_SOURCES = [
    {
        "source": "NeurIPS",
        "label": "NeurIPS",
        "inv": "NeurIPS.cc/{year}/Conference/-/Submission",
    },
    {
        "source": "ICML",
        "label": "ICML",
        "inv": "ICML.cc/{year}/Conference/-/Submission",
    },
    {
        "source": "ICLR",
        "label": "ICLR",
        "inv": "ICLR.cc/{year}/Conference/-/Submission",
    },
]

# Crossref 每本期刊检索的核心词（组合检索提升召回）
CROSSREF_QUERIES = [
    "neural operator",
    "physics-informed neural network",
    "machine learning fluid dynamics",
]

USER_AGENT = "CFDWiki/1.0 (academic literature search)"


# ---------------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------------

def _http_get(url: str, timeout: int = 25) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def _http_get_json(url: str, timeout: int = 25) -> Any:
    return json.loads(_http_get(url, timeout).decode("utf-8", "replace"))


def _clip(text: str, limit: int = 420) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _title_key(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (title or "").lower())


def _year_of(iso_date: str) -> int:
    if not iso_date:
        return date.today().year
    match = re.match(r"(\d{4})", iso_date)
    return int(match.group(1)) if match else date.today().year


def _extract_year_from_openreview(content: dict) -> int:
    venue = content.get("venue")
    if isinstance(venue, dict):
        venue = venue.get("value") or ""
    match = re.search(r"\b(20\d{2})\b", str(venue or ""))
    if match:
        return int(match.group(1))
    venueid = content.get("venueid")
    if isinstance(venueid, dict):
        venueid = venueid.get("value") or ""
    match = re.search(r"\b(20\d{2})\b", str(venueid or ""))
    return int(match.group(1)) if match else date.today().year


def _openreview_value(field: Any) -> str:
    """OpenReview 字段可能是 {'value': ...} 或裸值。"""
    if isinstance(field, dict):
        return str(field.get("value") or "")
    return str(field or "")


def _openreview_authors(field: Any) -> list[str]:
    value = field.get("value") if isinstance(field, dict) else field
    if isinstance(value, list):
        return [str(item.get("value") if isinstance(item, dict) else item) for item in value]
    if isinstance(value, str):
        return [value]
    return []


# ---------------------------------------------------------------------------
# arXiv
# ---------------------------------------------------------------------------

def fetch_arxiv(keywords: list[str], since: date, until: date, max_results: int = 60) -> list[dict]:
    """按关键词短语（OR）检索 arXiv，限定提交日期范围。"""
    since_str = since.strftime("%Y%m%d") + "0000"
    until_str = until.strftime("%Y%m%d") + "2359"
    papers: list[dict] = []
    seen: set[str] = set()

    # 关键词较多时拆批，避免 URL 过长
    batch_size = 8
    for start in range(0, len(keywords), batch_size):
        batch = keywords[start : start + batch_size]
        quoted = [f'all:"{kw.replace(chr(34), "")}"' for kw in batch]
        query = " OR ".join(quoted) + f" AND submittedDate:[{since_str} TO {until_str}]"
        url = (
            ARXIV_API
            + "?"
            + urllib.parse.urlencode(
                {
                    "search_query": query,
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                    "max_results": str(max_results),
                }
            )
        )
        try:
            root = ET.fromstring(_http_get(url, timeout=30))
        except Exception:
            continue
        for entry in root.findall(ARXIV_NS + "entry"):
            ident = (entry.findtext(ARXIV_NS + "id") or "").strip()
            title = re.sub(r"\s+", " ", (entry.findtext(ARXIV_NS + "title") or "")).strip()
            if not title or ident in seen:
                continue
            seen.add(ident)
            authors = [
                re.sub(r"\s+", " ", node.text or "").strip()
                for node in entry.findall(ARXIV_NS + "author/" + ARXIV_NS + "name")
                if node.text
            ]
            published = (entry.findtext(ARXIV_NS + "published") or "")[:10]
            papers.append(
                {
                    "id": "arxiv:" + ident.rsplit("/abs/", 1)[-1],
                    "title": title,
                    "authors": authors,
                    "year": _year_of(published),
                    "date": published,
                    "abstract": re.sub(r"\s+", " ", entry.findtext(ARXIV_NS + "summary") or "").strip(),
                    "source": "arXiv",
                    "venue": "arXiv",
                    "url": ident,
                    "doi": "",
                }
            )
    return papers


# ---------------------------------------------------------------------------
# Crossref（期刊）
# ---------------------------------------------------------------------------

def fetch_crossref(source: dict, since: date, until: date, max_results: int = 20) -> list[dict]:
    papers: list[dict] = []
    seen: set[str] = set()
    for query in CROSSREF_QUERIES:
        params = {
            "query": query,
            "filter": (
                f"issn:{source['issn']},"
                f"from-pub-date:{since.isoformat()},"
                f"until-pub-date:{until.isoformat()}"
            ),
            "rows": str(max_results),
            "select": "title,container-title,author,abstract,published,DOI,URL",
        }
        url = CROSSREF_API + "?" + urllib.parse.urlencode(params)
        try:
            data = _http_get_json(url, timeout=30)
        except Exception:
            continue
        for item in (data.get("message", {}).get("items") or []):
            title = (item.get("title") or [""])[0]
            if not title or title in seen:
                continue
            seen.add(title)
            authors = [
                f"{a.get('given', '')} {a.get('family', '')}".strip()
                for a in (item.get("author") or [])
            ]
            pub = (item.get("published") or {}).get("date-parts") or [[None]] * 1
            pub_date = pub[0]
            year = pub_date[0] if pub_date and pub_date[0] else date.today().year
            iso = "-".join(str(x).zfill(2) if i > 0 else str(x) for i, x in enumerate(pub_date) if x)
            abstract = re.sub(r"<[^>]+>", " ", item.get("abstract") or "").strip()
            doi = item.get("DOI", "")
            papers.append(
                {
                    "id": "doi:" + doi if doi else "cr:" + _title_key(title),
                    "title": re.sub(r"\s+", " ", title).strip(),
                    "authors": authors,
                    "year": year,
                    "date": iso,
                    "abstract": re.sub(r"\s+", " ", abstract).strip(),
                    "source": source["source"],
                    "venue": source["label"],
                    "url": item.get("URL") or (f"https://doi.org/{doi}" if doi else ""),
                    "doi": doi,
                }
            )
    return papers


# ---------------------------------------------------------------------------
# OpenReview（会议）
# ---------------------------------------------------------------------------

def fetch_openreview(
    conf: dict, since: date, until: date, max_results: int = 40
) -> list[dict]:
    """按会议投稿 invitation 检索。

    会议论文按「届次年份」而非投稿时间过滤：时间窗覆盖到哪些年份，就检索
    哪些届的会议（近 1 年对应当年 + 上一年两届，近 2 周则只取当届）。
    """
    papers: list[dict] = []
    seen: set[str] = set()

    for year in range(since.year, until.year + 1):
        invitation = conf["inv"].format(year=year)
        for query in ("neural operator", "physics-informed", "scientific machine learning"):
            params = {
                "term": query,
                "invitation": invitation,
                "limit": str(max_results),
                "sort": "cdate:desc",
            }
            url = OPENREVIEW_API + "?" + urllib.parse.urlencode(params)
            try:
                data = _http_get_json(url, timeout=30)
            except Exception:
                continue
            for note in data.get("notes") or []:
                content = note.get("content") or {}
                title = _openreview_value(content.get("title")).strip()
                if not title or title in seen:
                    continue
                seen.add(title)
                ident = str(note.get("id") or note.get("forum") or _title_key(title))
                venue = _openreview_value(content.get("venue"))
                papers.append(
                    {
                        "id": "or:" + ident,
                        "title": re.sub(r"\s+", " ", title).strip(),
                        "authors": _openreview_authors(content.get("authors")),
                        "year": _extract_year_from_openreview(content),
                        "date": date.today().isoformat(),
                        "abstract": re.sub(r"\s+", " ", _openreview_value(content.get("abstract"))).strip(),
                        "source": venue or conf["source"],
                        "venue": conf["label"],
                        "url": f"https://openreview.net/forum?id={ident}",
                        "doi": "",
                    }
                )
    return papers


# ---------------------------------------------------------------------------
# 去重 · 分类 · 简介
# ---------------------------------------------------------------------------

def _dedupe(papers: list[dict]) -> list[dict]:
    """按标题归一化去重；同题保留摘要更完整、来源为期刊的条目。"""
    priority = {"doi": 3, "arxiv": 2, "or": 1}
    by_title: dict[str, dict] = {}
    for paper in papers:
        key = _title_key(paper["title"])
        if not key:
            continue
        existing = by_title.get(key)
        if existing is None:
            by_title[key] = paper
            continue
        if len(paper.get("abstract") or "") > len(existing.get("abstract") or ""):
            by_title[key] = paper
    return list(by_title.values())


def _match_keywords(paper: dict, keywords: list[str]) -> list[str]:
    haystack = (paper["title"] + " " + (paper.get("abstract") or "")).lower()
    matched: list[str] = []
    for kw in keywords:
        token = kw.lower()
        # 对多词短语做宽松匹配：所有实质词都出现即命中
        parts = [p for p in re.split(r"\W+", token) if p]
        if parts and all(p in haystack for p in parts):
            matched.append(kw)
        elif token and token in haystack:
            matched.append(kw)
    return matched


def _finalize(papers: list[dict], keywords: list[str]) -> list[dict]:
    result: list[dict] = []
    for paper in papers:
        matched = _match_keywords(paper, keywords)
        if not matched:
            # 至少归入一个宽泛类别
            matched = ["其他相关"]
        paper["keywords"] = matched
        paper["summary"] = _clip(paper.get("abstract") or "", 420) or paper["title"]
        result.append(paper)
    result.sort(key=lambda p: (str(p.get("year") or ""), p["title"]), reverse=True)
    return result


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def fetch_all(keywords: list[str], days: int = 365) -> tuple[list[dict], list[str], list[str]]:
    """执行全量检索。

    返回 ``(papers, errors, sources)``：
    * papers  —— 已去重、分类、含简介的结果列表
    * errors  —— 各来源的失败信息（用于前端提示）
    * sources —— 命中的来源清单（用于前端展示覆盖率）
    """
    keywords = [kw for kw in keywords if kw and kw.strip()]
    if not keywords:
        keywords = list(DEFAULT_KEYWORDS)

    until = date.today()
    since = until - timedelta(days=days)
    papers: list[dict] = []
    errors: list[str] = []

    try:
        papers.extend(fetch_arxiv(keywords, since, until))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"arXiv：{exc}")

    for source in JOURNAL_SOURCES:
        try:
            papers.extend(fetch_crossref(source, since, until))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{source['label']}：{exc}")

    for conf in CONF_SOURCES:
        try:
            papers.extend(fetch_openreview(conf, since, until))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{conf['label']}：{exc}")

    papers = _dedupe(papers)
    papers = _finalize(papers, keywords)
    sources = sorted({p["venue"] for p in papers})
    return papers, errors, sources


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------

PAPERS_PATH = LIBRARY_DIR / "papers.json"
KEYWORDS_PATH = LIBRARY_DIR / "fetch_keywords.json"
STATE_PATH = LIBRARY_DIR / "fetch_state.json"

# 每周自动任务独立存储（与年度检索分离）
WEEKLY_PAPERS_PATH = LIBRARY_DIR / "weekly_papers.json"
WEEKLY_KEYWORDS_PATH = LIBRARY_DIR / "weekly_keywords.json"
WEEKLY_STATE_PATH = LIBRARY_DIR / "weekly_state.json"


def _load_json(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_papers() -> list[dict]:
    data = _load_json(PAPERS_PATH, [])
    return data if isinstance(data, list) else []


def save_papers(papers: list[dict]) -> None:
    _save_json(PAPERS_PATH, papers)


def merge_papers(existing: list[dict], incoming: list[dict]) -> list[dict]:
    """按 id 合并历史与本次检索结果，只增不减：新数据覆盖同 id 旧记录。

    即使某次检索失败返回空列表，历史数据也得以保留。
    """
    by_id: dict[str, dict] = {}
    for paper in existing:
        pid = paper.get("id")
        if pid:
            by_id[pid] = paper
    for paper in incoming:
        pid = paper.get("id")
        if pid:
            by_id[pid] = paper
    merged = list(by_id.values())
    merged.sort(key=lambda p: (str(p.get("year") or ""), p.get("title") or ""), reverse=True)
    return merged


def load_keywords() -> list[str]:
    data = _load_json(KEYWORDS_PATH, [])
    custom = data if isinstance(data, list) else []
    merged: list[str] = []
    for kw in list(DEFAULT_KEYWORDS) + custom:
        if kw and kw.strip() and kw not in merged:
            merged.append(kw.strip())
    return merged


def save_keywords(keywords: list[str]) -> None:
    # 只把「自定义」的那部分（不在默认列表里的）落盘，默认词每次动态补充
    custom = [kw.strip() for kw in keywords if kw and kw.strip() and kw.strip() not in DEFAULT_KEYWORDS]
    _save_json(KEYWORDS_PATH, custom)


def load_state() -> dict:
    data = _load_json(STATE_PATH, {})
    return data if isinstance(data, dict) else {}


def save_state(state: dict) -> None:
    _save_json(STATE_PATH, state)


def monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def state_snapshot() -> dict:
    state = load_state()
    return {
        "last_manual_at": state.get("last_manual_at", ""),
        "last_auto_at": state.get("last_auto_at", ""),
        "last_auto_monday": state.get("last_auto_monday", ""),
        "total": len(load_papers()),
        "keywords": load_keywords(),
    }


# ---------------------------------------------------------------------------
# 每周自动任务（独立关键词 / 独立结果 / 独立状态）
# ---------------------------------------------------------------------------

def load_weekly_papers() -> list[dict]:
    data = _load_json(WEEKLY_PAPERS_PATH, [])
    return data if isinstance(data, list) else []


def save_weekly_papers(papers: list[dict]) -> None:
    _save_json(WEEKLY_PAPERS_PATH, papers)


def load_weekly_keywords() -> list[str]:
    data = _load_json(WEEKLY_KEYWORDS_PATH, [])
    custom = data if isinstance(data, list) else []
    merged: list[str] = []
    for kw in list(DEFAULT_WEEKLY_KEYWORDS) + custom:
        if kw and kw.strip() and kw not in merged:
            merged.append(kw.strip())
    return merged


def save_weekly_keywords(keywords: list[str]) -> None:
    custom = [
        kw.strip()
        for kw in keywords
        if kw and kw.strip() and kw.strip() not in DEFAULT_WEEKLY_KEYWORDS
    ]
    _save_json(WEEKLY_KEYWORDS_PATH, custom)


def load_weekly_state() -> dict:
    data = _load_json(WEEKLY_STATE_PATH, {})
    return data if isinstance(data, dict) else {}


def save_weekly_state(state: dict) -> None:
    _save_json(WEEKLY_STATE_PATH, state)


def weekly_snapshot() -> dict:
    state = load_weekly_state()
    return {
        "last_auto_at": state.get("last_auto_at", ""),
        "last_auto_monday": state.get("last_auto_monday", ""),
        "total": len(load_weekly_papers()),
        "keywords": load_weekly_keywords(),
    }


def run_weekly_fetch(keywords: list[str], days: int = 14) -> dict:
    """每周自动检索：写入独立的 weekly 存储，不与年度结果混合。"""
    papers, errors, sources = fetch_all(keywords, days)
    merged = merge_papers(load_weekly_papers(), papers)
    save_weekly_papers(merged)
    save_weekly_keywords(keywords)
    now = datetime.now().isoformat(timespec="seconds")
    state = load_weekly_state()
    state["last_auto_at"] = now
    state["last_auto_monday"] = monday_of(date.today()).isoformat()
    save_weekly_state(state)
    return {
        "papers": papers,
        "errors": errors,
        "sources": sources,
        "total": len(merged),
        "new_count": len(papers),
        "ran_at": now,
        "window_days": days,
    }


# ---------------------------------------------------------------------------
# 周定时调度（任务二）
# ---------------------------------------------------------------------------

def run_fetch_and_store(keywords: list[str], days: int, trigger: str = "manual") -> dict:
    """年度（手动）检索：写入年度存储。trigger 保留兼容，auto 分支已由 run_weekly_fetch 接管。"""
    papers, errors, sources = fetch_all(keywords, days)
    merged = merge_papers(load_papers(), papers)
    save_papers(merged)
    save_keywords(keywords)
    now = datetime.now().isoformat(timespec="seconds")
    state = load_state()
    if trigger == "auto":
        state["last_auto_at"] = now
        state["last_auto_monday"] = monday_of(date.today()).isoformat()
    else:
        state["last_manual_at"] = now
    save_state(state)
    return {
        "papers": papers,
        "errors": errors,
        "sources": sources,
        "total": len(merged),
        "new_count": len(papers),
        "ran_at": now,
        "trigger": trigger,
        "window_days": days,
    }


def auto_fetch_if_due() -> dict | None:
    """若已跨入新的一周（以周一为界），自动检索上两周到独立的 weekly 存储。"""
    today = date.today()
    current_monday = monday_of(today)
    state = load_weekly_state()
    if not state.get("last_auto_monday"):
        # 首次运行：初始化基准，不立即触发
        state["last_auto_monday"] = current_monday.isoformat()
        save_weekly_state(state)
        return None
    if state["last_auto_monday"] == current_monday.isoformat():
        return None
    try:
        return run_weekly_fetch(load_weekly_keywords(), days=14)
    except Exception:  # noqa: BLE001
        # 调度失败不阻塞服务；保留基准避免频繁重试
        state["last_auto_monday"] = current_monday.isoformat()
        save_weekly_state(state)
        return None


# ---------------------------------------------------------------------------
# 命令行入口（供 GitHub Actions 或本地手动调用）
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="检索 AI for CFD 文献并写入 library/ 对应存储")
    parser.add_argument("--scope", choices=["yearly", "weekly"], default="yearly",
                        help="检索范围：yearly 写入年度存储（默认），weekly 写入每周任务存储")
    parser.add_argument("--days", type=int, default=365, help="检索时间窗天数（周任务用 14）")
    parser.add_argument("--keywords", nargs="*", default=None, help="临时覆盖关键词；不填则读取默认词 + 自定义词")
    args = parser.parse_args()

    if args.scope == "weekly":
        keywords = args.keywords if args.keywords else load_weekly_keywords()
        result = run_weekly_fetch(keywords, days=args.days)
    else:
        keywords = args.keywords if args.keywords else load_keywords()
        result = run_fetch_and_store(keywords, days=args.days, trigger="manual")
    print(f"检索完成：本次新增 {result['new_count']} 篇，累计 {result['total']} 篇，命中来源 {', '.join(result['sources']) or '无'}")
    if result["errors"]:
        print("失败来源：" + "；".join(result["errors"]))