"""Pure helpers shared by adapters: portable JSON Schema and strict JSON decoding."""

from __future__ import annotations

import json

from .errors import AiProviderError

# Validation keywords that several providers reject in structured-output schemas.
# Pydantic still validates the full contract after decoding, so nothing is lost.
UNPORTABLE_SCHEMA_KEYWORDS = frozenset({
    "title", "default", "pattern", "format", "minLength", "maxLength",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems",
})
INVALID_MODEL_OUTPUT_MESSAGE = (
    "Réponse du modèle invalide ou incomplète. Choisissez un modèle capable de produire du JSON structuré et réessayez."
)


def build_portable_schema(json_schema: dict) -> dict:
    """Inline `$defs` and drop keywords that providers handle inconsistently."""
    definitions = json_schema.get("$defs", {})
    portable_schema = _simplify_node(json_schema, definitions)
    return portable_schema


def decode_model_json(content: object) -> dict:
    """Parse the model's JSON text without repairing it; duplicate keys are refused."""
    if isinstance(content, dict):
        return content
    if not isinstance(content, str):
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)
    try:
        decoded = json.loads(content, object_pairs_hook=_reject_duplicate_keys)
    except ValueError as error:
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE) from error
    if not isinstance(decoded, dict):
        raise AiProviderError(502, INVALID_MODEL_OUTPUT_MESSAGE)
    return decoded


def _simplify_node(node: object, definitions: dict) -> object:
    if isinstance(node, list):
        return [_simplify_node(child, definitions) for child in node]
    if not isinstance(node, dict):
        return node
    reference = node.get("$ref")
    if isinstance(reference, str) and reference.startswith("#/$defs/"):
        return _simplify_node(definitions[reference.removeprefix("#/$defs/")], definitions)
    simplified = {
        key: _simplify_node(child, definitions)
        for key, child in node.items()
        if key not in UNPORTABLE_SCHEMA_KEYWORDS and key != "$defs"
    }
    return simplified


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    parsed: dict = {}
    for key, field_value in pairs:
        if key in parsed:
            raise ValueError("Duplicate JSON field")
        parsed[key] = field_value
    return parsed
