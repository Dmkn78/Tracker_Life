"""Encryption at rest for provider API keys (Fernet = AES-128-CBC + HMAC-SHA256)."""

from __future__ import annotations

import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from .errors import AiProviderError

KEY_DERIVATION_INFO = b"life-regime:ai-provider-api-keys:v1"
VISIBLE_KEY_SUFFIX_LENGTH = 4


def encrypt_api_key(secret: str, api_key: str) -> str:
    encrypted_key = _build_cipher(secret).encrypt(api_key.encode("utf-8")).decode("ascii")
    return encrypted_key


def decrypt_api_key(secret: str, encrypted_key: str) -> str:
    try:
        api_key = _build_cipher(secret).decrypt(encrypted_key.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as error:
        raise AiProviderError(409, "La clé API enregistrée ne peut plus être lue (secret serveur modifié). Saisissez-la à nouveau.") from error
    return api_key


def build_api_key_hint(api_key: str) -> str:
    """Only the last characters are ever shown back to the user."""
    key_hint = f"…{api_key[-VISIBLE_KEY_SUFFIX_LENGTH:]}" if len(api_key) > VISIBLE_KEY_SUFFIX_LENGTH * 2 else "…"
    return key_hint


def _build_cipher(secret: str) -> Fernet:
    derived_key = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=KEY_DERIVATION_INFO).derive(secret.encode("utf-8"))
    cipher = Fernet(base64.urlsafe_b64encode(derived_key))
    return cipher
