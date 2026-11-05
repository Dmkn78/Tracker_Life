"""Pure parsing of Obsidian Markdown: YAML frontmatter, wikilinks, hashtags and sections."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime

import yaml

FRONTMATTER_PATTERN = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)
WIKILINK_PATTERN = re.compile(r"\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]")
HASHTAG_PATTERN = re.compile(r"(?<![\w#/&])#([\w][\w/-]*)", re.UNICODE)
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.*)$", re.MULTILINE)
FENCED_CODE_PATTERN = re.compile(r"```.*?```", re.DOTALL)


@dataclass(frozen=True)
class NoteSection:
    heading: str
    text: str


@dataclass(frozen=True)
class ParsedNote:
    frontmatter: dict
    body: str


def parse_note(text: str) -> ParsedNote:
    """Invalid YAML never blocks reading: the note is kept with an empty frontmatter."""
    match = FRONTMATTER_PATTERN.match(text)
    if match is None:
        return ParsedNote(frontmatter={}, body=text)
    try:
        loaded = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        loaded = None
    frontmatter = _normalize_yaml_values(loaded) if isinstance(loaded, dict) else {}
    parsed_note = ParsedNote(frontmatter=frontmatter, body=text[match.end():])
    return parsed_note


def render_frontmatter(frontmatter: dict) -> str:
    rendered_yaml = yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False).strip()
    rendered_frontmatter = f"---\n{rendered_yaml}\n---\n"
    return rendered_frontmatter


def extract_wikilink_targets(body: str) -> list[str]:
    targets = [target.strip() for target in WIKILINK_PATTERN.findall(_strip_code(body))]
    unique_targets = list(dict.fromkeys(target for target in targets if target))
    return unique_targets


def extract_hashtags(body: str) -> list[str]:
    tags = [tag for tag in HASHTAG_PATTERN.findall(_strip_code(body)) if not tag.isdigit()]
    unique_tags = list(dict.fromkeys(tags))
    return unique_tags


def split_sections(body: str) -> list[NoteSection]:
    """One section per heading; text before the first heading belongs to an untitled section."""
    sections: list[NoteSection] = []
    current_heading = ""
    current_start = 0
    for match in HEADING_PATTERN.finditer(body):
        sections.append(NoteSection(current_heading, body[current_start:match.start()].strip()))
        current_heading = match.group(2).strip()
        current_start = match.end()
    sections.append(NoteSection(current_heading, body[current_start:].strip()))
    non_empty_sections = [section for section in sections if section.text or section.heading]
    return non_empty_sections


def read_frontmatter_tags(frontmatter: dict) -> list[str]:
    raw_tags = frontmatter.get("tags") or []
    tag_list = [raw_tags] if isinstance(raw_tags, str) else raw_tags if isinstance(raw_tags, list) else []
    normalized_tags = [str(tag).lstrip("#").strip() for tag in tag_list if str(tag).strip()]
    return normalized_tags


def _strip_code(body: str) -> str:
    return FENCED_CODE_PATTERN.sub(" ", body)


def _normalize_yaml_values(node: object) -> object:
    """YAML dates become ISO strings so frontmatter is always JSON-serializable."""
    if isinstance(node, dict):
        return {str(key): _normalize_yaml_values(child) for key, child in node.items()}
    if isinstance(node, list):
        return [_normalize_yaml_values(child) for child in node]
    if isinstance(node, (date, datetime)):
        return node.isoformat()
    return node
