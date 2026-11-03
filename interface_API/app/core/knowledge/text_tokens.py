"""Accent-insensitive tokenization shared by indexing and querying (French and English)."""

from __future__ import annotations

import re
import unicodedata

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
MIN_TOKEN_LENGTH = 2
PLURAL_STRIP_MIN_LENGTH = 4
STOPWORDS = frozenset("""
le la les un une des du de d l au aux et ou en dans sur sous pour par avec sans ce ces cet cette
que qui quoi dont est sont ete etre avoir a as ai ont je tu il elle nous vous ils elles me te se
mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ne pas plus moins tres
the a an and or of to in on for with without is are was were be been it this that these those
i you he she we they my your his her our their not no as at by from
""".split())


def tokenize(text: str) -> list[str]:
    folded_text = fold_accents(text.lower())
    tokens = [
        _strip_plural(token)
        for token in TOKEN_PATTERN.findall(folded_text)
        if len(token) >= MIN_TOKEN_LENGTH and token not in STOPWORDS
    ]
    return tokens


def fold_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    folded_text = "".join(character for character in decomposed if not unicodedata.combining(character))
    return folded_text


def _strip_plural(token: str) -> str:
    # Minimal stemming so "martingales" matches "martingale"; deliberately conservative.
    if len(token) >= PLURAL_STRIP_MIN_LENGTH and token[-1] in "sx" and not token.endswith("ss"):
        return token[:-1]
    return token
