"""Turn a Markdown note into an indexed document (pure)."""

from __future__ import annotations

from collections import Counter

from .managed_block import MANAGED_BEGIN, MANAGED_END
from .markdown_note import extract_hashtags, extract_wikilink_targets, parse_note, read_frontmatter_tags, split_sections
from .search_index import IndexedDocument, IndexedSection
from .text_tokens import tokenize

DEFAULT_NOTE_TYPE = "note"


def index_note(relative_path: str, text: str, modified_at: float) -> IndexedDocument:
    parsed = parse_note(text)
    body = parsed.body.replace(MANAGED_BEGIN, "").replace(MANAGED_END, "")
    sections = split_sections(body)
    title = _read_title(relative_path, parsed.frontmatter, sections)
    tags = list(dict.fromkeys([*read_frontmatter_tags(parsed.frontmatter), *extract_hashtags(body)]))
    note_type = str(parsed.frontmatter.get("type") or DEFAULT_NOTE_TYPE)
    raw_date = parsed.frontmatter.get("date") or parsed.frontmatter.get("created")
    indexed_document = IndexedDocument(
        path=relative_path,
        title=title,
        note_type=note_type,
        date_key=str(raw_date)[:10] if raw_date else None,
        tags=tags,
        link_targets=extract_wikilink_targets(body),
        sections=[_index_section(section.heading, section.text) for section in sections],
        modified_at=modified_at,
        title_terms=frozenset(tokenize(title)),
        tag_terms=frozenset(tokenize(" ".join([*tags, note_type]).replace("/", " "))),
    )
    return indexed_document


def _read_title(relative_path: str, frontmatter: dict, sections: list) -> str:
    frontmatter_title = frontmatter.get("title")
    if isinstance(frontmatter_title, str) and frontmatter_title.strip():
        return frontmatter_title.strip()
    first_heading = next((section.heading for section in sections if section.heading), None)
    title = first_heading or relative_path.rsplit("/", 1)[-1].removesuffix(".md")
    return title


def _index_section(heading: str, text: str) -> IndexedSection:
    terms = tokenize(f"{heading} {text}")
    indexed_section = IndexedSection(heading=heading, text=text, term_counts=Counter(terms), length=len(terms))
    return indexed_section
