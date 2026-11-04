"""Pydantic contracts at the system boundaries: actions, changes, facts, issues, API bodies.

R7: `Action` is the single source of truth for action types. The LLM prompt embeds its JSON Schema,
the API validates against it, and the frontend picker builds its form from GET /api/actions/schema.
R11: all timestamps are time-zone aware (AwareDatetime); zone-less input is rejected.
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import AwareDatetime, BaseModel, Field, TypeAdapter, model_validator


class SourceRef(BaseModel):
    file: str  # relative to data/synthetic, e.g. "KESSLER/csmp.csv"
    loc: str = ""  # "row 14", "line 9", "page 1"
    span: str = ""  # verbatim text when the fact came from free text
    key: str = ""  # record key (JCN, doc number, member_id ...)


# ------------------------------------------------------------------ actions (R7)
class RemovePerson(BaseModel):
    """Take a sailor off the ship (transfer, TAD, leave, medical) from a date."""
    type: Literal["remove_person"] = "remove_person"
    ship_id: str
    member_id: str = Field(description="Synthetic member id, e.g. M-0019")
    from_time: AwareDatetime
    until_time: Optional[AwareDatetime] = None
    reason: str = "what-if"

    @model_validator(mode="after")
    def chronological(self):
        if self.until_time is not None and self.until_time <= self.from_time:
            raise ValueError("until_time must be after from_time")
        return self


class DelayPart(BaseModel):
    """Push a requisition's arrival later by N days."""
    type: Literal["delay_part"] = "delay_part"
    ship_id: str
    doc_number: str = Field(description="MILSTRIP document number, e.g. R991016308A001")
    days: float = Field(ge=-60, le=365)


class AddCasrep(BaseModel):
    """What-if: a new casualty on a component or system."""
    type: Literal["add_casrep"] = "add_casrep"
    ship_id: str
    eic: str = Field(description="Component or system EIC from the mission tree, e.g. GUN5-HYD")
    category: Literal[2, 3, 4]
    etr: AwareDatetime


class ShiftMission(BaseModel):
    """Move a mission (event) start by N days."""
    type: Literal["shift_mission"] = "shift_mission"
    event_id: str
    days: float = Field(ge=-30, le=60)


class ApplyFix(BaseModel):
    """Approve one of the ranked fixes by its fix_id."""
    type: Literal["apply_fix"] = "apply_fix"
    fix_id: str


Action = Annotated[Union[RemovePerson, DelayPart, AddCasrep, ShiftMission, ApplyFix], Field(discriminator="type")]
ActionAdapter: TypeAdapter = TypeAdapter(Action)
ACTION_TYPES = ["remove_person", "delay_part", "add_casrep", "shift_mission", "apply_fix"]


def action_schema() -> dict:
    return ActionAdapter.json_schema()


# ------------------------------------------------------------------ extracted facts (LLM job a)
FactType = Literal["personnel_transfer", "personnel_tad", "assist_eta", "expedite_requested", "pms_lost",
                   "casrep_reported", "training_scheduled", "other", "casrep_status", "repair_estimate",
                   "part_requirement", "assistance_request", "casrep_narrative"]


class FactDetails(BaseModel):
    eic: Optional[str] = None
    category: Optional[Literal[2, 3, 4]] = None
    report_type: Optional[Literal["INITIAL", "UPDATE", "CORRECT", "CANCEL"]] = None
    timestamp: Optional[AwareDatetime] = None
    doc_number: Optional[str] = None
    niin: Optional[str] = Field(None, pattern=r"^\d{9}$")
    quantity: Optional[int] = Field(None, gt=0, strict=True)


class ExtractedFact(FactDetails):
    fact_id: str
    doc: str  # relative path of the source document
    page: int = 1
    type: FactType
    ship_id: str
    member_id: Optional[str] = None
    date: Optional[str] = None  # "12 NOV"
    until: Optional[str] = None
    value: Optional[str] = None
    span: str  # verbatim (redacted-text) sentence
    hedged: bool = False
    method: Literal["llm", "cache", "rules"] = "rules"
    status: Literal["VERIFIED", "UNCONFIRMED", "NEEDS_REVIEW"] = "VERIFIED"
    reason: str = ""
    known_at: Optional[AwareDatetime] = None
    corroboration: Literal["corroborates", "contradicts", "new_information", "n/a"] = "n/a"
    corroboration_note: str = ""
    document_type: Literal["daily_report", "casrep"] = "daily_report"
    line: Optional[int] = None
    casrep_id: Optional[str] = None


class LLMFactOut(FactDetails):
    """Schema the LLM must return for extraction."""
    type: FactType
    member_token: Optional[str] = Field(None, description="Redaction token like M-0007 if a person is named")
    date: Optional[str] = Field(None, description="DD MON, e.g. 12 NOV")
    until: Optional[str] = None
    value: Optional[str] = None
    span: str = Field(min_length=1, description="The exact sentence or CASREP set copied from the document")
    hedged: bool = False

    @model_validator(mode="after")
    def casrep_fields(self):
        required = {
            "casrep_status": ("eic", "category", "report_type"),
            "repair_estimate": ("timestamp",),
            "part_requirement": ("doc_number", "niin", "quantity"),
            "assistance_request": ("value",),
        }
        if any(getattr(self, name) is None for name in required.get(self.type, ())):
            raise ValueError(f"missing fields for {self.type}")
        if not self.span.strip():
            raise ValueError("source span must not be blank")
        return self


class LLMFactsOut(BaseModel):
    facts: list[LLMFactOut]


class IngestIssue(BaseModel):
    file: str
    loc: str
    reason: str
    kind: Literal["parse", "validation", "extraction"] = "parse"


class Contradiction(BaseModel):
    id: str  # X1..X10
    ship_id: str
    title: str
    detail: str
    sources: list[SourceRef]
    severity: Literal["info", "warn", "high"] = "warn"


# ------------------------------------------------------------------ API bodies
class ChangeBody(BaseModel):
    base_version: int
    kind: Literal["action", "set_assumption", "confirm_fact", "play_event"] = "action"
    action: Optional[Action] = None
    key: Optional[str] = None
    value: Optional[Any] = None
    fact_id: Optional[str] = None
    include: Optional[bool] = None
    event_id: Optional[str] = None

    @model_validator(mode="after")
    def required_payload(self):
        if self.kind == "action" and self.action is None:
            raise ValueError("action required")
        if self.kind == "set_assumption" and (self.key is None or self.value is None):
            raise ValueError("key and value required")
        if self.kind == "confirm_fact" and (not self.fact_id or self.include is None):
            raise ValueError("fact_id and include required")
        return self


class FixDecisionBody(BaseModel):
    base_version: int
    fix_id: str
    decision: Literal["approve", "reject"]
    approval_delay_days: float = Field(0.0, ge=0, le=30, description="Edit: days until the fix can start")
    note: str = ""


class VersionBody(BaseModel):
    base_version: int


class ParseBody(BaseModel):
    text: str
    ship_id: str = "KESSLER"


class BriefBody(BaseModel):
    ship_id: str = "KESSLER"
