"""Contracts for the question-triggered Ask Davey assistant.

The model produces only the draft types below. Server-owned identity, forecast values,
source excerpts, and review state are added after validating that draft.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DaveyAskBody(BaseModel):
    question: str = Field(min_length=3, max_length=600)
    ship_id: str
    event_id: str | None = None
    node_id: str | None = None
    expected_version: int = Field(ge=0)
    expected_source_revision: str
    expected_epoch: str
    expected_scenario_digest: str
    expected_cursor: str
    expected_source_health_at: str
    request_id: str = Field(min_length=8, max_length=80)
    previous_answer_id: str | None = None

    @field_validator("question")
    @classmethod
    def nonblank_question(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("question needs at least three non-space characters")
        return cleaned


class _StrictOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DaveyWarningDraft(_StrictOutput):
    kind: Literal["forecasted", "emerging"]
    title: str
    explanation: str
    event_id: str
    claim_ids: list[str]
    evidence_ids: list[str]
    verification: str
    trace_node_id: str | None


class DaveyNodeDraft(_StrictOutput):
    id: str
    kind: Literal["support_team", "organization", "part", "repair_task", "equipment"]
    label: str
    why: str
    evidence_ids: list[str]
    verification: str


class DaveyLinkDraft(_StrictOutput):
    id: str
    dependent_id: str
    dependency_id: str
    relation: Literal["requires", "supported_by", "may_depend_on"]
    why: str
    evidence_ids: list[str]


class DaveyDraft(_StrictOutput):
    answer: str
    answer_claim_ids: list[str]
    answer_evidence_ids: list[str]
    warnings: list[DaveyWarningDraft]
    proposed_nodes: list[DaveyNodeDraft]
    proposed_links: list[DaveyLinkDraft]


DAVEY_SCHEMA = DaveyDraft.model_json_schema()
