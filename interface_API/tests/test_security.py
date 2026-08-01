from __future__ import annotations

import unittest

from app.security import _b64url_encode, _sign, decode_session, encode_session


class SessionSecurityTests(unittest.TestCase):
    def test_round_trip_session(self) -> None:
        token, _ = encode_session("user-123")

        self.assertEqual(decode_session(token), "user-123")

    def test_malformed_session_is_rejected_without_error(self) -> None:
        malformed_tokens = [
            None,
            "",
            "missing-signature",
            "body.short",
            "not-base64.invalid-signature",
            "é.invalid-signature",
            self._signed_payload("[]"),
            self._signed_payload('{"userId":"user-123","exp":"tomorrow"}'),
        ]

        for token in malformed_tokens:
            with self.subTest(token=token):
                self.assertIsNone(decode_session(token))

    @staticmethod
    def _signed_payload(payload: str) -> str:
        body = _b64url_encode(payload.encode("utf-8"))
        return f"{body}.{_sign(body)}"


if __name__ == "__main__":
    unittest.main()
