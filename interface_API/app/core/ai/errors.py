"""Errors raised by the AI layer, already phrased for the end user."""

from __future__ import annotations


class AiProviderError(Exception):
    """A provider call failed; `status_code` is the HTTP status to return to the client."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
