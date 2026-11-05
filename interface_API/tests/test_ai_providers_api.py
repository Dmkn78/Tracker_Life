"""Settings → AI models: providers are owned, keys are encrypted and never returned."""

from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.ai.adapters import anthropic_adapter, openai_adapter
from app.database import get_db
from app.main import app
from app.models import AiProvider
from app.security import get_current_user


class AiProvidersApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        metadata = MetaData()
        AiProvider.__table__.to_metadata(metadata)
        metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.user = SimpleNamespace(id="provider-user")
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def create(self, **body) -> dict:
        response = self.client.post("/api/ai-providers", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["provider"]

    def test_local_preset_needs_only_the_kind(self) -> None:
        provider = self.create(kind="lmstudio")

        self.assertEqual(provider["baseUrl"], "http://127.0.0.1:1234/v1")
        self.assertEqual(provider["label"], "LM Studio")
        self.assertTrue(provider["isDefault"])
        self.assertTrue(provider["isLocal"])

    def test_cloud_key_is_encrypted_and_never_returned(self) -> None:
        provider = self.create(kind="openai", apiKey="sk-PRIVATE-abcd", model="gpt-x")

        stored = self.db.scalar(select(AiProvider))
        self.assertNotIn("sk-PRIVATE", stored.encryptedApiKey)
        listing = self.client.get("/api/ai-providers").text
        self.assertNotIn("sk-PRIVATE", listing)
        self.assertNotIn(stored.encryptedApiKey, listing)
        self.assertTrue(provider["hasApiKey"])
        self.assertEqual(provider["apiKeyHint"], "…abcd")

    def test_cloud_provider_without_key_is_refused(self) -> None:
        response = self.client.post("/api/ai-providers", json={"kind": "anthropic"})

        self.assertEqual(response.status_code, 400, response.text)

    def test_default_moves_and_survives_deletion(self) -> None:
        first = self.create(kind="lmstudio")
        second = self.create(kind="ollama")
        self.assertFalse(second["isDefault"])

        self.client.patch("/api/ai-providers", json={"id": second["id"], "isDefault": True})
        self.client.delete(f"/api/ai-providers?id={second['id']}")

        remaining = self.client.get("/api/ai-providers").json()["providers"]
        self.assertEqual([provider["id"] for provider in remaining], [first["id"]])
        self.assertTrue(remaining[0]["isDefault"])

    def test_other_users_provider_is_invisible(self) -> None:
        self.db.add(AiProvider(id="foreign", userId="someone-else", kind="lmstudio", label="x", baseUrl="http://127.0.0.1:1"))
        self.db.flush()

        self.assertEqual(self.client.get("/api/ai-providers").json()["providers"], [])
        self.assertEqual(self.client.patch("/api/ai-providers", json={"id": "foreign", "model": "m"}).status_code, 404)
        self.assertEqual(self.client.delete("/api/ai-providers?id=foreign").status_code, 404)
        self.assertEqual(self.client.post("/api/ai-providers/test", json={"providerId": "foreign"}).status_code, 404)

    def test_draft_test_lists_models_without_saving(self) -> None:
        with patch.object(anthropic_adapter, "request_provider_json", new_callable=AsyncMock) as request:
            request.return_value = {"data": [{"id": "claude-model"}]}
            response = self.client.post("/api/ai-providers/test", json={"kind": "anthropic", "apiKey": "sk-ant-PRIVATE"})

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["models"], ["claude-model"])
        self.assertEqual(request.await_args.args[0].headers["x-api-key"], "sk-ant-PRIVATE")
        self.assertIsNone(self.db.scalar(select(AiProvider)))

    def test_saved_provider_test_uses_the_decrypted_key(self) -> None:
        provider = self.create(kind="openrouter", apiKey="sk-or-PRIVATE")
        with patch.object(openai_adapter, "request_provider_json", new_callable=AsyncMock) as request:
            request.return_value = {"data": [{"id": "router/model"}]}
            response = self.client.post("/api/ai-providers/test", json={"providerId": provider["id"]})

        self.assertEqual(response.status_code, 200, response.text)
        provider_request = request.await_args.args[0]
        self.assertEqual(provider_request.url, "https://openrouter.ai/api/v1/models")
        self.assertEqual(provider_request.headers["Authorization"], "Bearer sk-or-PRIVATE")

    def test_unsafe_urls_are_refused(self) -> None:
        for base_url in ("http://example.com/v1", "http://169.254.169.254", "file:///etc"):
            with self.subTest(base_url=base_url):
                response = self.client.post("/api/ai-providers", json={"kind": "openai_compatible", "baseUrl": base_url})
                self.assertEqual(response.status_code, 400, response.text)

    def test_unknown_kind_is_refused(self) -> None:
        self.assertEqual(self.client.post("/api/ai-providers", json={"kind": "mystery"}).status_code, 400)

    def test_endpoints_require_authentication(self) -> None:
        app.dependency_overrides.pop(get_current_user)

        self.assertEqual(self.client.get("/api/ai-providers").status_code, 401)
        self.assertEqual(self.client.post("/api/ai-providers/test", json={"kind": "lmstudio"}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
