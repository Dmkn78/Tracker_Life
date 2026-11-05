"""Single entry point used by features: discover models or generate validated structured output."""

from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .adapters import ADAPTERS_BY_PROTOCOL
from .connection import ProviderConnection, StructuredPrompt
from .errors import AiProviderError
from .structured_output import INVALID_MODEL_OUTPUT_MESSAGE

ContractModel = TypeVar("ContractModel", bound=BaseModel)


async def list_provider_models(connection: ProviderConnection) -> list[str]:
    adapter = ADAPTERS_BY_PROTOCOL[connection.protocol]
    model_identifiers = await adapter.list_models(connection)
    return model_identifiers


async def generate_validated(
    connection: ProviderConnection,
    prompt: StructuredPrompt,
    contract: type[ContractModel],
) -> ContractModel:
    """Ask the provider for JSON and validate it against the full Pydantic contract."""
    if not connection.model:
        raise AiProviderError(400, "Sélectionnez un modèle avant de lancer une génération.")
    adapter = ADAPTERS_BY_PROTOCOL[connection.protocol]
    generated_object = await adapter.generate_json(connection, prompt)
    try:
        validated_answer = contract.model_validate(generated_object)
    except ValidationError as error:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE) from error
    return validated_answer
