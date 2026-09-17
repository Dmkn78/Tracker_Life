"""Bounded audio segments with short overlaps for continuous speech."""
import re
import unicodedata

SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 30 * 60
SEGMENT_SECONDS = 20
OVERLAP_SECONDS = 1


def segment_ranges(sample_count: int):
    start = 0
    length = SEGMENT_SECONDS * SAMPLE_RATE
    overlap = OVERLAP_SECONDS * SAMPLE_RATE
    while start < sample_count:
        end = min(start + length, sample_count)
        yield start, end
        if end == sample_count:
            break
        start = end - overlap


def append_segment(previous: str, incoming: str) -> str:
    """Remove words repeated by the overlap without changing their spelling."""
    incoming = incoming.strip()
    if not previous or not incoming:
        return previous or incoming
    left, right = previous.split(), incoming.split()
    def normalized(word):
        return re.sub(r"[^\w]", "", unicodedata.normalize("NFKC", word).casefold())
    for count in range(min(16, len(left), len(right)), 0, -1):
        suffix = [normalized(word) for word in left[-count:]]
        if any(suffix) and suffix == [normalized(word) for word in right[:count]]:
            if count == len(right):
                return previous
            # Keep the existing word's casing, but use the new segment's punctuation.
            boundary = re.sub(r"\W+$", "", left[-1]) + re.search(r"\W*$", right[count - 1]).group()
            return " ".join([*left[:-1], boundary, *right[count:]])
    return previous + " " + incoming
