"""Hybrid search over notes: BM25 on sections + title/tag metadata + link graph + recency.

Every hit carries the reasons that produced its score, so results stay explainable.
Embeddings are intentionally not required: for a personal vault, lexical + metadata +
graph signals are fast, deterministic and traceable. See docs/REFONTE.md for the extension point.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field

from .text_tokens import tokenize

BM25_K1 = 1.2
BM25_B = 0.75
TITLE_WEIGHT = 1.5
TAG_WEIGHT = 1.0
GRAPH_WEIGHT = 0.25
GRAPH_SEED_COUNT = 5
RECENCY_WEIGHT = 0.2
RECENCY_HALF_LIFE_DAYS = 60
EXCERPT_LENGTH = 280
SECONDS_PER_DAY = 86_400


@dataclass(frozen=True)
class IndexedSection:
    heading: str
    text: str
    term_counts: Counter
    length: int


@dataclass(frozen=True)
class IndexedDocument:
    path: str
    title: str
    note_type: str
    date_key: str | None
    tags: list[str]
    link_targets: list[str]
    sections: list[IndexedSection]
    modified_at: float
    title_terms: frozenset[str] = field(default_factory=frozenset)
    tag_terms: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class SearchIndex:
    documents: dict[str, IndexedDocument]
    section_frequency: Counter
    section_count: int
    average_section_length: float
    neighbors: dict[str, frozenset[str]]


@dataclass(frozen=True)
class SearchQuery:
    text: str
    now_timestamp: float
    note_types: frozenset[str] = frozenset()
    date_from: str | None = None
    date_to: str | None = None
    limit: int = 10


@dataclass
class SearchHit:
    path: str
    title: str
    note_type: str
    date_key: str | None
    score: float
    excerpt: str
    heading: str
    reasons: list[str]


def build_search_index(documents: list[IndexedDocument]) -> SearchIndex:
    documents_by_path = {document.path: document for document in documents}
    sections = [section for document in documents for section in document.sections]
    section_frequency: Counter = Counter()
    for section in sections:
        section_frequency.update(set(section.term_counts))
    total_length = sum(section.length for section in sections)
    search_index = SearchIndex(
        documents=documents_by_path,
        section_frequency=section_frequency,
        section_count=len(sections),
        average_section_length=total_length / len(sections) if sections else 0.0,
        neighbors=_build_neighbors(documents_by_path),
    )
    return search_index


def search_notes(index: SearchIndex, query: SearchQuery) -> list[SearchHit]:
    query_terms = list(dict.fromkeys(tokenize(query.text)))
    candidates = [document for document in index.documents.values() if _matches_filters(document, query)]
    if not query_terms:
        recent_hits = [_recent_hit(document) for document in sorted(candidates, key=lambda document: -document.modified_at)]
        return recent_hits[:query.limit]
    hits = [hit for hit in (_score_document(index, document, query_terms, query.now_timestamp) for document in candidates) if hit]
    boosted_hits = _apply_graph_boost(index, hits)
    ranked_hits = sorted(boosted_hits, key=lambda hit: -hit.score)[:query.limit]
    return ranked_hits


def _score_document(index: SearchIndex, document: IndexedDocument, query_terms: list[str], now_timestamp: float) -> SearchHit | None:
    section_scores = [(_bm25(index, section, query_terms), section) for section in document.sections]
    best_score, best_section = max(section_scores, key=lambda scored: scored[0], default=(0.0, None))
    title_share = _matched_share(query_terms, document.title_terms)
    tag_share = _matched_share(query_terms, document.tag_terms)
    if best_score <= 0 and title_share == 0 and tag_share == 0:
        return None
    reasons = [label for label, is_present in (
        ("texte", best_score > 0), ("titre", title_share > 0), ("tag/type", tag_share > 0),
    ) if is_present]
    recency_bonus = RECENCY_WEIGHT * _recency_factor(document.modified_at, now_timestamp)
    score = best_score + TITLE_WEIGHT * title_share + TAG_WEIGHT * tag_share + recency_bonus
    excerpt_section = best_section or document.sections[0] if document.sections else None
    hit = SearchHit(
        path=document.path, title=document.title, note_type=document.note_type, date_key=document.date_key,
        score=round(score, 4), heading=excerpt_section.heading if excerpt_section else "",
        excerpt=_build_excerpt(excerpt_section.text if excerpt_section else "", query_terms), reasons=reasons,
    )
    return hit


def _bm25(index: SearchIndex, section: IndexedSection, query_terms: list[str]) -> float:
    if not section.length or not index.section_count:
        return 0.0
    score = 0.0
    for term in query_terms:
        term_count = section.term_counts.get(term, 0)
        if not term_count:
            continue
        frequency = index.section_frequency[term]
        inverse_frequency = math.log(1 + (index.section_count - frequency + 0.5) / (frequency + 0.5))
        length_ratio = section.length / index.average_section_length
        score += inverse_frequency * term_count * (BM25_K1 + 1) / (term_count + BM25_K1 * (1 - BM25_B + BM25_B * length_ratio))
    return score


def _apply_graph_boost(index: SearchIndex, hits: list[SearchHit]) -> list[SearchHit]:
    """Notes linked to the strongest matches gain a share of their score (documents that cite each other)."""
    hits_by_path = {hit.path: hit for hit in hits}
    seeds = sorted(hits, key=lambda hit: -hit.score)[:GRAPH_SEED_COUNT]
    boosts: dict[str, list[tuple[float, str]]] = {}
    for seed in seeds:
        for neighbor_path in index.neighbors.get(seed.path, frozenset()):
            if neighbor_path in hits_by_path and neighbor_path != seed.path:
                boosts.setdefault(neighbor_path, []).append((GRAPH_WEIGHT * seed.score, seed.title))
    for path, received in boosts.items():
        hit = hits_by_path[path]
        hit.score = round(hit.score + sum(boost for boost, _ in received), 4)
        hit.reasons.append("lié à " + ", ".join(title for _, title in received[:3]))
    return hits


def _build_neighbors(documents_by_path: dict[str, IndexedDocument]) -> dict[str, frozenset[str]]:
    paths_by_stem: dict[str, str] = {}
    for path in documents_by_path:
        paths_by_stem.setdefault(path.rsplit("/", 1)[-1].removesuffix(".md").lower(), path)
    neighbors: dict[str, set[str]] = {path: set() for path in documents_by_path}
    for path, document in documents_by_path.items():
        for target in document.link_targets:
            target_path = _resolve_link_target(target, documents_by_path, paths_by_stem)
            if target_path and target_path != path:
                neighbors[path].add(target_path)
                neighbors[target_path].add(path)
    frozen_neighbors = {path: frozenset(linked) for path, linked in neighbors.items()}
    return frozen_neighbors


def _resolve_link_target(target: str, documents_by_path: dict[str, IndexedDocument], paths_by_stem: dict[str, str]) -> str | None:
    if f"{target}.md" in documents_by_path:
        return f"{target}.md"
    resolved_path = paths_by_stem.get(target.rsplit("/", 1)[-1].lower())
    return resolved_path


def _matches_filters(document: IndexedDocument, query: SearchQuery) -> bool:
    if query.note_types and document.note_type not in query.note_types:
        return False
    if query.date_from and (document.date_key is None or document.date_key < query.date_from):
        return False
    if query.date_to and (document.date_key is None or document.date_key > query.date_to):
        return False
    return True


def _matched_share(query_terms: list[str], field_terms: frozenset[str]) -> float:
    matched_count = sum(1 for term in query_terms if term in field_terms)
    share = matched_count / len(query_terms)
    return share


def _recency_factor(modified_at: float, now_timestamp: float) -> float:
    age_days = max(0.0, (now_timestamp - modified_at) / SECONDS_PER_DAY)
    factor = 0.5 ** (age_days / RECENCY_HALF_LIFE_DAYS)
    return factor


def _build_excerpt(text: str, query_terms: list[str]) -> str:
    """Centre the excerpt on the first matching word when possible."""
    flattened_text = " ".join(text.split())
    words = flattened_text.split(" ")
    first_match = next((position for position, word in enumerate(words) if set(tokenize(word)) & set(query_terms)), 0)
    start_word = max(0, first_match - 12)
    excerpt = " ".join(words[start_word:])[:EXCERPT_LENGTH]
    prefix = "… " if start_word > 0 else ""
    suffix = " …" if len(" ".join(words[start_word:])) > EXCERPT_LENGTH else ""
    return f"{prefix}{excerpt}{suffix}"


def _recent_hit(document: IndexedDocument) -> SearchHit:
    first_section = document.sections[0] if document.sections else None
    recent_hit = SearchHit(
        path=document.path, title=document.title, note_type=document.note_type, date_key=document.date_key,
        score=0.0, heading=first_section.heading if first_section else "",
        excerpt=_build_excerpt(first_section.text if first_section else "", []), reasons=["récent"],
    )
    return recent_hit
