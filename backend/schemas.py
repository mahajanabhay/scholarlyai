"""
schemas.py — Strict JSON schemas and validation for all AI outputs.

This module defines Pydantic models for all AI-generated content, ensuring
type safety, validation, and serialization. All LLM outputs are validated
against these schemas before use.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
import json


# ============================================================================
# MCQ AND QUIZ SCHEMAS
# ============================================================================

class MCQOption(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"letter": "A", "text": "Option text"}})
    letter: str = Field(..., pattern="^[A-D]$")
    text:   str = Field(..., min_length=1, max_length=500)


class MCQuestion(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    question:    str            = Field(..., min_length=10, max_length=1000)
    options:     List[MCQOption] = Field(..., min_length=4, max_length=4)
    answer:      str            = Field(..., pattern="^[A-D]$")
    explanation: str            = Field(default="", max_length=500)

    @field_validator('options')
    @classmethod
    def validate_unique_letters(cls, options):
        letters = [opt.letter for opt in options]
        if sorted(letters) != ["A", "B", "C", "D"]:
            raise ValueError("Options must have letters A, B, C, D")
        return options


class MCQSet(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    questions: List[MCQuestion] = Field(..., min_length=1)
    count:     int              = Field(..., ge=1)

    @model_validator(mode="after")
    def validate_count(self):
        self.count = len(self.questions)
        return self


class ExamPaper(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    subject:       str        = Field(..., min_length=1, max_length=200)
    questions:     List[dict] = Field(..., min_length=1)
    total_marks:   int        = Field(default=0, ge=0)
    num_questions: int        = Field(..., ge=1)


class ExamAnswerKey(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    answers:  List[dict] = Field(...)
    metadata: dict       = Field(default_factory=dict)


class StudySessionFeedback(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    score:                int        = Field(..., ge=0)
    total:                int        = Field(..., ge=1)
    xp_earned:            int        = Field(default=0, ge=0)
    summary:              str        = Field(..., max_length=500)
    strengths:            List[str]  = Field(default_factory=list)
    weaknesses:           List[str]  = Field(default_factory=list)
    weaknesses_recorded:  int        = Field(default=0, ge=0)


class RetryableQuestion(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    original_topic:   str             = Field(...)
    difficulty_level: str             = Field(..., pattern="^(easy|medium|hard)$")
    questions:        List[MCQuestion] = Field(..., min_length=1)


class AcademicExplanation(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    concept:           str       = Field(..., max_length=200)
    explanation:       str       = Field(..., max_length=1000)
    key_points:        List[str] = Field(..., max_length=5)
    real_world_example: str      = Field(..., max_length=500)
    practice_question: str       = Field(..., max_length=300)


class SimplifiedConcept(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    original_concept:       str = Field(...)
    simplified_explanation: str = Field(..., max_length=800)
    analogy:                str = Field(..., max_length=400)
    difficulty_level:       str = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    key_takeaway:           str = Field(..., max_length=200)


class RAGResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    answer:       str       = Field(..., max_length=1000)
    source_found: bool      = Field(default=True)
    sources:      List[str] = Field(default_factory=list)
    confidence:   float     = Field(default=0.8, ge=0.0, le=1.0)


class ValidationError(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {}})
    error:             str = Field(...)
    validation_schema: str = Field(...)
    raw_output:        str = Field(default="")
    retry_count:       int = Field(default=0, ge=0)


def validate_schema(data: dict | str, schema_class) -> tuple[bool, any, Optional[str]]:
    try:
        if isinstance(data, str):
            data = json.loads(data)
        obj = schema_class(**data)
        return True, obj, None
    except json.JSONDecodeError as e:
        return False, None, f"Invalid JSON: {str(e)}"
    except Exception as e:
        return False, None, f"Validation failed: {str(e)}"


def to_dict(pydantic_obj) -> dict:
    return pydantic_obj.model_dump(exclude_none=True)


def to_json(pydantic_obj: BaseModel, indent: int = 2) -> str:
    return pydantic_obj.model_dump_json(indent=indent, exclude_none=True)