"""Keep the search index in memory and re-parse only notes whose file changed."""

from __future__ import annotations

from threading import Lock

from .note_indexing import index_note
from .search_index import IndexedDocument, SearchIndex, build_search_index
from .vault_store import VaultStore

FileSignature = tuple[float, int]

_cache_lock = Lock()
_documents_by_root: dict[str, dict[str, tuple[FileSignature, IndexedDocument]]] = {}
_index_by_root: dict[str, tuple[frozenset, SearchIndex]] = {}


def load_search_index(store: VaultStore) -> SearchIndex:
    root_key = str(store.root)
    with _cache_lock:
        cached_documents = _documents_by_root.setdefault(root_key, {})
        current_documents: dict[str, tuple[FileSignature, IndexedDocument]] = {}
        for vault_file in store.list_markdown_files():
            signature = (vault_file.modified_at, vault_file.size)
            cached = cached_documents.get(vault_file.relative_path)
            if cached is not None and cached[0] == signature:
                current_documents[vault_file.relative_path] = cached
                continue
            text = store.read_text(vault_file.relative_path) or ""
            current_documents[vault_file.relative_path] = (signature, index_note(vault_file.relative_path, text, vault_file.modified_at))
        _documents_by_root[root_key] = current_documents
        corpus_signature = frozenset((path, signature) for path, (signature, _) in current_documents.items())
        cached_index = _index_by_root.get(root_key)
        if cached_index is None or cached_index[0] != corpus_signature:
            cached_index = (corpus_signature, build_search_index([document for _, document in current_documents.values()]))
            _index_by_root[root_key] = cached_index
        search_index = cached_index[1]
    return search_index
