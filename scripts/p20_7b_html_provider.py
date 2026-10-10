"""Small, source-independent parsers used by the P20.7B evidence run.

The module deliberately only parses rows returned by an official page.  It does
not guess identifiers or promote a partial page to an active publication.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from urllib.parse import urljoin

from bs4 import BeautifulSoup


@dataclass(frozen=True)
class ProposalRow:
    source_id: str
    title: str
    type_raw: str | None
    number: str | None
    year: int | None
    process: str | None
    protocol: str | None
    authors: tuple[str, ...]
    source_url: str

    def as_dict(self) -> dict:
        return asdict(self)


def parse_spl_cards(html: str, base_url: str) -> list[ProposalRow]:
    """Parse one ALES/ALBA consulta-producao page.

    ASP.NET repeater pagination is intentionally handled by the caller; this
    function never fabricates rows when a page is empty or incomplete.
    """
    soup = BeautifulSoup(html, "html.parser")
    rows: list[ProposalRow] = []
    seen: set[str] = set()
    for card in soup.select(".kt-widget5__item"):
        links = card.select("a[href*='processo.aspx'], a[href*='proposicao'], a[href*='detal']")
        source_url = urljoin(base_url, links[0].get("href", "")) if links else base_url
        text = " ".join(card.get_text(" ", strip=True).split())
        ident = re.search(r"(?:ID|Id)\s*[:№º]?\s*(\d+)", text)
        if not ident:
            ident = re.search(r"(?:id|proposicao)[=/](\d+)", source_url, re.I)
        if not ident or ident.group(1) in seen:
            continue
        source_id = ident.group(1)
        seen.add(source_id)
        heading = card.select_one("h3, h4, .kt-widget5__title")
        title = " ".join((heading or card).get_text(" ", strip=True).split())
        mt = re.search(r"([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]+?)\s+(\d+)\s*/\s*(\d{4})", title)
        authors_match = re.search(r"Autor(?:es)?\s*:?\s*(.*)$", text, re.I)
        authors = tuple(x.strip(" ;,") for x in re.split(r"\s+e\s+|;", authors_match.group(1)) if x.strip()) if authors_match else ()
        rows.append(ProposalRow(
            source_id=source_id,
            title=title,
            type_raw=mt.group(1).strip() if mt else None,
            number=mt.group(2) if mt else None,
            year=int(mt.group(3)) if mt else None,
            process=_first(r"Processo\s*(?:N[ºo°])?\s*[:\-]?\s*([\w./-]+)", text),
            protocol=_first(r"Protocolo\s*(?:N[ºo°])?\s*[:\-]?\s*([\w./-]+)", text),
            authors=authors,
            source_url=source_url,
        ))
    return rows


def parse_mt_card(html: str, base_url: str) -> list[ProposalRow]:
    """Parse the official MT /proposicao page using its source cpdoc IDs."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[ProposalRow] = []
    seen: set[str] = set()
    for link in soup.select("a[href^='/proposicao/cpdoc/'][href$='/visualizar']"):
        match = re.search(r"/cpdoc/(\d+)/", link.get("href", ""))
        if not match or match.group(1) in seen:
            continue
        source_id = match.group(1); seen.add(source_id)
        card = list(link.parents)[3] if len(list(link.parents)) > 3 else link.parent
        text = " ".join(card.get_text(" ", strip=True).split())
        heading = card.select_one("h3, h4")
        title = " ".join((heading or card).get_text(" ", strip=True).split())
        mt = re.search(r"([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]+?)\s+n[ºo°]?\s*(\d+)\s*/\s*(\d{4})", text, re.I)
        author_match = re.search(r"AUTORES?:\s*(.*?)(?=\s+(?:Projeto|Veto|Requerimento|Indicação|Moção)\b)", title, re.I)
        authors = tuple(x.strip(" ;,") for x in re.split(r"\s+E\s+|;", author_match.group(1)) if x.strip()) if author_match else ()
        rows.append(ProposalRow(
            source_id=source_id, title=title,
            type_raw=mt.group(1).strip() if mt else None,
            number=mt.group(2) if mt else None,
            year=int(mt.group(3)) if mt else 2026,
            process=_first(r"Processo\s*n[ºo°]?\s*([\w./-]+)", text),
            protocol=_first(r"Protocolo\s*n[ºo°]?\s*([\w./-]+)", text),
            authors=authors,
            source_url=urljoin(base_url, link.get("href", "")),
        ))
    return rows


def _first(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, re.I)
    return match.group(1) if match else None
