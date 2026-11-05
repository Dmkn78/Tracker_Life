"""Contract of an AI analysis, and the citation policy applied before showing it."""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

MAX_STATEMENTS = 12


class StrictContract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class CitedStatement(StrictContract):
    text: str = Field(min_length=1, max_length=1500)
    sources: list[str] = Field(max_length=12)


class InsightAnswer(StrictContract):
    summary: str = Field(max_length=4000)
    facts: list[CitedStatement] = Field(max_length=MAX_STATEMENTS)
    hypotheses: list[CitedStatement] = Field(max_length=MAX_STATEMENTS)
    recommendations: list[CitedStatement] = Field(max_length=MAX_STATEMENTS)


@dataclass(frozen=True)
class CheckedStatement:
    text: str
    sources: list[str]

    def to_json(self) -> dict:
        return {"text": self.text, "sources": self.sources}


@dataclass(frozen=True)
class CheckedAnswer:
    summary: str
    facts: list[CheckedStatement]
    hypotheses: list[CheckedStatement]
    recommendations: list[CheckedStatement]
    unverified: list[CheckedStatement]

    def cited_ids(self) -> set[str]:
        statements = [*self.facts, *self.hypotheses, *self.recommendations]
        cited_ids = {source for statement in statements for source in statement.sources}
        return cited_ids

    def to_json(self) -> dict:
        answer_json = {
            "summary": self.summary,
            "facts": [statement.to_json() for statement in self.facts],
            "hypotheses": [statement.to_json() for statement in self.hypotheses],
            "recommendations": [statement.to_json() for statement in self.recommendations],
            "unverified": [statement.to_json() for statement in self.unverified],
        }
        return answer_json


def apply_citation_policy(answer: InsightAnswer, known_source_ids: set[str]) -> CheckedAnswer:
    """Unknown ids are removed. A 'fact' left without any valid source is not shown as a fact."""
    facts = [_keep_known_sources(statement, known_source_ids) for statement in answer.facts]
    checked_answer = CheckedAnswer(
        summary=answer.summary,
        facts=[fact for fact in facts if fact.sources],
        hypotheses=[_keep_known_sources(statement, known_source_ids) for statement in answer.hypotheses],
        recommendations=[_keep_known_sources(statement, known_source_ids) for statement in answer.recommendations],
        unverified=[fact for fact in facts if not fact.sources],
    )
    return checked_answer


def _keep_known_sources(statement: CitedStatement, known_source_ids: set[str]) -> CheckedStatement:
    known_sources = list(dict.fromkeys(source for source in statement.sources if source in known_source_ids))
    checked_statement = CheckedStatement(statement.text.strip(), known_sources)
    return checked_statement
