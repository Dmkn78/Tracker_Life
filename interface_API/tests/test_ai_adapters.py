"""Each provider protocol is spoken correctly, and the transport/policy fail safely."""

import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import BaseModel, ConfigDict

from app.core.ai import http_transport
from app.core.ai.adapters import anthropic_adapter, gemini_adapter, ollama_adapter, openai_adapter
from app.core.ai.api_key_cipher import build_api_key_hint, decrypt_api_key, encrypt_api_key
from app.core.ai.connection import ProviderConnection, StructuredPrompt
from app.core.ai.endpoint_policy import normalize_provider_base_url
from app.core.ai.errors import AiProviderError
from app.core.ai.gateway import generate_validated
from app.core.ai.structured_output import build_portable_schema


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str


PROMPT = StructuredPrompt(system="SYSTEM", user="USER", schema_name="answer", json_schema=Answer.model_json_schema())
ANSWER = {"summary": "ok"}


def connection(protocol: str, base_url: str, api_key: str | None = "secret-key") -> ProviderConnection:
    return ProviderConnection(protocol=protocol, base_url=base_url, model="model-x", api_key=api_key)


class AdapterProtocolTests(unittest.IsolatedAsyncioTestCase):
    async def run_adapter(self, adapter, provider_connection: ProviderConnection, provider_response: dict):
        with patch.object(adapter, "request_provider_json", new_callable=AsyncMock) as request:
            request.return_value = provider_response
            answer = await generate_validated(provider_connection, PROMPT, Answer)
        return answer, request.await_args.args[0]

    async def test_openai_compatible_uses_chat_completions_with_json_schema(self) -> None:
        response = {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(ANSWER)}}]}
        answer, request = await self.run_adapter(openai_adapter, connection("openai", "https://api.openai.com/v1"), response)

        self.assertEqual(answer.summary, "ok")
        self.assertEqual(request.url, "https://api.openai.com/v1/chat/completions")
        self.assertEqual(request.headers["Authorization"], "Bearer secret-key")
        self.assertEqual(request.payload["response_format"]["type"], "json_schema")

    async def test_anthropic_forces_a_single_tool_call(self) -> None:
        response = {"content": [{"type": "text", "text": "ignored"}, {"type": "tool_use", "name": "answer", "input": ANSWER}]}
        answer, request = await self.run_adapter(anthropic_adapter, connection("anthropic", "https://api.anthropic.com"), response)

        self.assertEqual(answer.summary, "ok")
        self.assertEqual(request.url, "https://api.anthropic.com/v1/messages")
        self.assertEqual(request.headers["x-api-key"], "secret-key")
        self.assertIn("anthropic-version", request.headers)
        self.assertEqual(request.payload["tool_choice"], {"type": "tool", "name": "answer"})
        self.assertEqual(request.payload["system"], "SYSTEM")

    async def test_gemini_uses_generate_content_with_json_mime_type(self) -> None:
        response = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(ANSWER)}]}}]}
        answer, request = await self.run_adapter(gemini_adapter, connection("gemini", "https://generativelanguage.googleapis.com"), response)

        self.assertEqual(answer.summary, "ok")
        self.assertEqual(request.url, "https://generativelanguage.googleapis.com/v1beta/models/model-x:generateContent")
        self.assertEqual(request.headers["x-goog-api-key"], "secret-key")
        self.assertEqual(request.payload["generationConfig"]["responseMimeType"], "application/json")

    async def test_ollama_uses_native_chat_with_format_schema(self) -> None:
        response = {"done": True, "message": {"role": "assistant", "content": json.dumps(ANSWER)}}
        answer, request = await self.run_adapter(ollama_adapter, connection("ollama", "http://127.0.0.1:11434", None), response)

        self.assertEqual(answer.summary, "ok")
        self.assertEqual(request.url, "http://127.0.0.1:11434/api/chat")
        self.assertNotIn("Authorization", request.headers)
        self.assertEqual(request.payload["format"]["type"], "object")

    async def test_model_lists_are_read_per_protocol(self) -> None:
        cases = (
            (openai_adapter, "openai", {"data": [{"id": "a"}, {"id": "a"}, {"id": "b"}]}, ["a", "b"]),
            (anthropic_adapter, "anthropic", {"data": [{"id": "claude-x"}]}, ["claude-x"]),
            (ollama_adapter, "ollama", {"models": [{"name": "llama3:8b"}]}, ["llama3:8b"]),
            (gemini_adapter, "gemini", {"models": [
                {"name": "models/gemini-x", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/embedding", "supportedGenerationMethods": ["embedContent"]},
            ]}, ["gemini-x"]),
        )
        for adapter, protocol, provider_response, expected_models in cases:
            with self.subTest(protocol=protocol), patch.object(adapter, "request_provider_json", new_callable=AsyncMock) as request:
                request.return_value = provider_response
                models = await adapter.list_models(connection(protocol, "https://example.org"))
                self.assertEqual(models, expected_models)
                self.assertIsNone(request.await_args.args[0].payload)

    async def test_invalid_or_incomplete_outputs_are_rejected(self) -> None:
        bad_openai_responses = (
            {"choices": [{"finish_reason": "length", "message": {"content": json.dumps(ANSWER)}}]},
            {"choices": [{"finish_reason": "stop", "message": {"content": "not json"}}]},
            {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"summary": "x", "extra": 1})}}]},
            {"choices": []},
        )
        for provider_response in bad_openai_responses:
            with self.subTest(response=provider_response), self.assertRaises(AiProviderError) as raised:
                await self.run_adapter(openai_adapter, connection("openai", "https://x.org/v1"), provider_response)
            self.assertEqual(raised.exception.status_code, 502)
        with self.assertRaises(AiProviderError):
            await self.run_adapter(anthropic_adapter, connection("anthropic", "https://x.org"), {"content": [{"type": "text", "text": "{}"}]})

    async def test_missing_model_is_refused_before_any_call(self) -> None:
        with patch.object(openai_adapter, "request_provider_json", new_callable=AsyncMock) as request:
            with self.assertRaises(AiProviderError):
                await generate_validated(ProviderConnection("openai", "https://x.org/v1", ""), PROMPT, Answer)
            request.assert_not_awaited()


class EndpointPolicyTests(unittest.TestCase):
    def test_accepted_urls_are_normalized(self) -> None:
        cases = {
            "http://localhost:1234/v1/": "http://127.0.0.1:1234/v1",
            "http://192.168.1.20:11434": "http://192.168.1.20:11434",
            "http://100.101.102.103:1234/v1": "http://100.101.102.103:1234/v1",
            "https://openrouter.ai/api/v1": "https://openrouter.ai/api/v1",
            "https://my-server.example.com/llm": "https://my-server.example.com/llm",
        }
        for raw_url, expected_url in cases.items():
            with self.subTest(url=raw_url):
                self.assertEqual(normalize_provider_base_url(raw_url), expected_url)

    def test_refused_urls(self) -> None:
        for raw_url in (
            "http://example.com/v1", "http://169.254.169.254/latest", "https://169.254.169.254",
            "file:///etc/passwd", "http://user:pw@127.0.0.1:1234", "http://127.0.0.1:1234/v1?key=x",
            "https://0.0.0.0", "ftp://127.0.0.1", "",
        ):
            with self.subTest(url=raw_url), self.assertRaises(AiProviderError):
                normalize_provider_base_url(raw_url)


class PortableSchemaTests(unittest.TestCase):
    def test_refs_are_inlined_and_unportable_keywords_dropped(self) -> None:
        schema = {
            "$defs": {"Item": {"type": "object", "properties": {"name": {"type": "string", "maxLength": 9, "title": "Name"}}}},
            "type": "object", "title": "Root",
            "properties": {"items": {"type": "array", "maxItems": 3, "items": {"$ref": "#/$defs/Item"}}},
        }

        portable = build_portable_schema(schema)

        self.assertEqual(portable, {
            "type": "object",
            "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}}}}},
        })


class ApiKeyCipherTests(unittest.TestCase):
    def test_round_trip_and_wrong_secret(self) -> None:
        encrypted = encrypt_api_key("secret-a", "sk-very-private-1234")

        self.assertNotIn("sk-very-private", encrypted)
        self.assertEqual(decrypt_api_key("secret-a", encrypted), "sk-very-private-1234")
        self.assertEqual(build_api_key_hint("sk-very-private-1234"), "…1234")
        with self.assertRaises(AiProviderError) as raised:
            decrypt_api_key("secret-b", encrypted)
        self.assertEqual(raised.exception.status_code, 409)


class TransportTests(unittest.IsolatedAsyncioTestCase):
    async def send(self, handler, url: str = "http://127.0.0.1:1234/v1/models"):
        client_class = httpx.AsyncClient
        transport = httpx.MockTransport(handler)
        with patch.object(http_transport.httpx, "AsyncClient", side_effect=lambda **options: client_class(transport=transport, **options)) as factory:
            response = await http_transport.request_provider_json(http_transport.ProviderHttpRequest(url, {"Authorization": "Bearer PRIVATE_KEY"}))
        return response, factory.call_args.kwargs

    async def test_client_ignores_env_proxies_and_redirects(self) -> None:
        response, options = await self.send(lambda request: httpx.Response(200, json={"data": []}))

        self.assertEqual(response, {"data": []})
        self.assertFalse(options["trust_env"])
        self.assertFalse(options["follow_redirects"])

    async def test_failures_map_to_safe_messages(self) -> None:
        def timeout(request):
            raise httpx.ReadTimeout("PRIVATE_KEY", request=request)

        def unavailable(request):
            raise httpx.ConnectError("PRIVATE_KEY", request=request)

        cases = (
            (timeout, 504), (unavailable, 503),
            (lambda request: httpx.Response(302, headers={"Location": "http://x"}), 502),
            (lambda request: httpx.Response(401, text="PRIVATE_KEY"), 502),
            (lambda request: httpx.Response(429), 429),
            (lambda request: httpx.Response(200, content=b"not json"), 502),
            (lambda request: httpx.Response(200, content=b"x" * (http_transport.MAX_PROVIDER_RESPONSE_BYTES + 1)), 502),
        )
        for handler, expected_status in cases:
            with self.subTest(expected_status=expected_status), self.assertRaises(AiProviderError) as raised:
                await self.send(handler)
            self.assertEqual(raised.exception.status_code, expected_status)
            self.assertNotIn("PRIVATE_KEY", raised.exception.message)

    async def test_hostnames_resolving_to_link_local_are_refused(self) -> None:
        with patch.object(http_transport, "ensure_resolved_host_allowed", side_effect=AiProviderError(400, "refused")):
            with self.assertRaises(AiProviderError):
                await self.send(lambda request: httpx.Response(200, json={}), "https://metadata.example/v1/models")


if __name__ == "__main__":
    unittest.main()
