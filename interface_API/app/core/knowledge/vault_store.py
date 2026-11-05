"""Filesystem boundary of the vault: safe paths, atomic writes, never overwrite on create."""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

MARKDOWN_SUFFIX = ".md"
MAX_NOTE_BYTES = 2_000_000
IGNORED_DIRECTORY_PREFIXES = (".",)


class VaultPathError(ValueError):
    """A path escapes the vault or is not a Markdown note."""


@dataclass(frozen=True)
class VaultFile:
    relative_path: str
    modified_at: float
    size: int


class VaultStore:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def ensure_exists(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def list_markdown_files(self) -> list[VaultFile]:
        if not self.root.is_dir():
            return []
        vault_files: list[VaultFile] = []
        for directory, subdirectories, filenames in os.walk(self.root):
            # Obsidian settings, trash and other hidden folders are not notes.
            subdirectories[:] = [name for name in subdirectories if not name.startswith(IGNORED_DIRECTORY_PREFIXES)]
            for filename in filenames:
                if not filename.endswith(MARKDOWN_SUFFIX):
                    continue
                absolute_path = Path(directory) / filename
                file_stat = absolute_path.stat()
                if file_stat.st_size <= MAX_NOTE_BYTES:
                    relative_path = absolute_path.relative_to(self.root).as_posix()
                    vault_files.append(VaultFile(relative_path, file_stat.st_mtime, file_stat.st_size))
        return vault_files

    def read_text(self, relative_path: str) -> str | None:
        absolute_path = self.resolve(relative_path)
        if not absolute_path.is_file():
            return None
        note_text = absolute_path.read_text(encoding="utf-8", errors="replace")
        return note_text

    def write_atomic(self, relative_path: str, text: str) -> None:
        """Write to a temporary file then rename, so Obsidian never sees a half-written note."""
        absolute_path = self.resolve(relative_path)
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(dir=absolute_path.parent, prefix=".tracker-", suffix=".tmp")
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as temporary_file:
                temporary_file.write(text)
            os.replace(temporary_name, absolute_path)
        except BaseException:
            Path(temporary_name).unlink(missing_ok=True)
            raise

    def create_new(self, relative_path: str, text: str) -> str:
        """Create a note without ever replacing an existing one; a numeric suffix avoids collisions."""
        stem = relative_path.removesuffix(MARKDOWN_SUFFIX)
        candidate_path = relative_path
        for attempt in range(1, 1000):
            absolute_path = self.resolve(candidate_path)
            absolute_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                with open(absolute_path, "x", encoding="utf-8", newline="\n") as new_file:
                    new_file.write(text)
                return candidate_path
            except FileExistsError:
                candidate_path = f"{stem} ({attempt + 1}){MARKDOWN_SUFFIX}"
        raise VaultPathError(f"Impossible de créer une note unique pour {relative_path}")

    def resolve(self, relative_path: str) -> Path:
        candidate = (self.root / relative_path).resolve()
        if not candidate.is_relative_to(self.root) or candidate.suffix != MARKDOWN_SUFFIX:
            raise VaultPathError(f"Chemin de note invalide : {relative_path}")
        return candidate
