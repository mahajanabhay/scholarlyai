"""
schemas.py — Strict JSON schemas and validation for all AI outputs.

This module defines Pydantic models for all AI-generated content, ensuring
type safety, validation, and serialization. All LLM outputs are validated
against these schemas before use.
"""

from ast import pattern
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator, validator
import json


# ============================================================================
# MCQ AND QUIZ SCHEMAS
# ============================================================================

class MCQOption(BaseModel):
    """Single multiple-choice option."""
    letter: str = Field(..., pattern="^[A-D]$", description="Option letter (A-D)")
    text: str = Field(..., min_length=1, max_length=500, description="Option text")

    class Config:
        json_schema_extra = {
            "example": {
                "letter": "A",
                "text": "Photosynthesis is the process where plants convert light into chemical energy"
            }
        }


class MCQuestion(BaseModel):
    """Single multiple-choice question with validation."""
    question: str = Field(..., min_length=10, max_length=1000, description="Question text")
    options: List[MCQOption] = Field(..., min_items=4, max_items=4, description="Exactly 4 options")
    answer: str = Field(..., pattern="^[A-D]$", description="Correct answer letter")
    explanation: str = Field(default="", max_length=500, description="Why answer is correct")

    @validator('options')
    def validate_unique_letters(cls, options):
        """Ensure options have unique letters A-D."""
        letters = [opt.letter for opt in options]
        if sorted(letters) != ["A", "B", "C", "D"]:
            raise ValueError("Options must have letters A, B, C, D in order")
        return options

    class Config:
        json_schema_extra = {
            "example": {
                "question": "What is photosynthesis?",
                "options": [
                    {"letter": "A", "text": "Option A"},
                    {"letter": "B", "text": "Option B"},
                    {"letter": "C", "text": "Option C"},
                    {"letter": "D", "text": "Option D"}
                ],
                "answer": "B",
                "explanation": "This is correct because..."
            }
        }


class MCQSet(BaseModel):
    """Set of MCQ questions (batch)."""
    questions: List[MCQuestion] = Field(..., min_items=1, description="List of questions")
    count: int = Field(..., ge=1, description="Total number of questions")

    @model_validator(mode="after")
    def validate_count(cls, values):
        """Ensure count matches actual number of questions."""
        if values.get("count") != len(values.get("questions", [])):
            values["count"] = len(values.get("questions", []))
        return values

    class Config:
        json_schema_extra = {
            "example": {
                "questions": [],
                "count": 4
            }
        }


class ExamPaper(BaseModel):
    """Structured exam paper with questions of varying difficulty."""
    subject: str = Field(..., min_length=1, max_length=200, description="Subject/Topic")
    questions: List[dict] = Field(..., min_items=1, description="List of questions with marks")
    total_marks: int = Field(default=0, ge=0, description="Total marks for paper")
    num_questions: int = Field(..., ge=1, description="Total number of questions")

    class Config:
        json_schema_extra = {
            "example": {
                "subject": "Photosynthesis",
                "questions": [
                    {"number": 1, "text": "Q1", "marks": 2, "type": "short_answer"}
                ],
                "total_marks": 20,
                "num_questions": 5
            }
        }


class ExamAnswerKey(BaseModel):
    """Answer key for an exam paper."""
    answers: List[dict] = Field(..., description="Answer for each question")
    metadata: dict = Field(default_factory=dict, description="Additional info")

    class Config:
        json_schema_extra = {
            "example": {
                "answers": [
                    {"question_number": 1, "answer": "text", "explanation": "reason"}
                ],
                "metadata": {"total_questions": 5}
            }
        }


# ============================================================================
# STUDY SESSION SCHEMAS
# ============================================================================

class StudySessionFeedback(BaseModel):
    """Feedback after study session."""
    score: int = Field(..., ge=0, description="Score achieved")
    total: int = Field(..., ge=1, description="Total questions")
    xp_earned: int = Field(default=0, ge=0, description="XP points earned")
    summary: str = Field(..., max_length=500, description="Encouraging feedback")
    strengths: List[str] = Field(default_factory=list, description="Student strengths")
    weaknesses: List[str] = Field(default_factory=list, description="Areas to improve")
    weaknesses_recorded: int = Field(default=0, ge=0, description="Number of weaknesses recorded")

    class Config:
        json_schema_extra = {
            "example": {
                "score": 3,
                "total": 4,
                "xp_earned": 35,
                "summary": "Great work! You showed strong understanding...",
                "strengths": ["photosynthesis", "cellular respiration"],
                "weaknesses": ["mitosis"],
                "weaknesses_recorded": 1
            }
        }


class RetryableQuestion(BaseModel):
    """Question focused on weak area for retry session."""
    original_topic: str = Field(..., description="Original weak area")
    difficulty_level: str = Field(..., pattern="^(easy|medium|hard)$")
    questions: List[MCQuestion] = Field(..., min_items=1, description="Retry questions")

    class Config:
        json_schema_extra = {
            "example": {
                "original_topic": "mitosis",
                "difficulty_level": "medium",
                "questions": []
            }
        }


# ============================================================================
# STUDY AI CHAT SCHEMAS
# ============================================================================

class AcademicExplanation(BaseModel):
    """Structured academic explanation from Study-Only AI."""
    concept: str = Field(..., max_length=200, description="Concept being explained")
    explanation: str = Field(..., max_length=1000, description="Main explanation")
    key_points: List[str] = Field(..., max_items=5, description="Bullet points")
    real_world_example: str = Field(..., max_length=500, description="Practical example")
    practice_question: str = Field(..., max_length=300, description="Question to test understanding")

    class Config:
        json_schema_extra = {
            "example": {
                "concept": "Photosynthesis",
                "explanation": "Process where plants...",
                "key_points": ["Uses light", "Produces glucose"],
                "real_world_example": "Green plants in sunlight...",
                "practice_question": "What is the main product of photosynthesis?"
            }
        }


class SimplifiedConcept(BaseModel):
    """Simplified explanation with different approach."""
    original_concept: str = Field(..., description="Concept being simplified")
    simplified_explanation: str = Field(..., max_length=800)
    analogy: str = Field(..., max_length=400, description="Fresh analogy")
    difficulty_level: str = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    key_takeaway: str = Field(..., max_length=200)

    class Config:
        json_schema_extra = {
            "example": {
                "original_concept": "Photosynthesis",
                "simplified_explanation": "Plants make food from sunlight...",
                "analogy": "Like a solar panel converting light to electricity",
                "difficulty_level": "beginner",
                "key_takeaway": "Plants need sunlight to grow"
            }
        }


class RAGResponse(BaseModel):
    """Response from RAG system with source attribution."""
    answer: str = Field(..., max_length=1000, description="Answer to query")
    source_found: bool = Field(default=True, description="Whether answer was in sources")
    sources: List[str] = Field(default_factory=list, description="Source documents")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Confidence score")

    class Config:
        json_schema_extra = {
            "example": {
                "answer": "Photosynthesis is...",
                "source_found": True,
                "sources": ["page_5", "page_12"],
                "confidence": 0.95
            }
        }


# ============================================================================
# VALIDATION AND ERROR HANDLING
# ============================================================================

class ValidationError(BaseModel):
    """Structured validation error response."""
    error: str = Field(..., description="Error message")
    validation_schema: str = Field(..., description="Schema that failed")
    raw_output: str = Field(default="", description="Raw output that failed validation")
    retry_count: int = Field(default=0, ge=0, description="Number of retries attempted")

    class Config:
        json_schema_extra = {
            "example": {
                "error": "Invalid JSON structure",
                "schema": "MCQSet",
                "raw_output": "{invalid json}",
                "retry_count": 2
            }
        }


# ============================================================================
# UTILITIES
# ============================================================================

def validate_schema(data: dict | str, schema_class) -> tuple[bool, any, Optional[str]]:
    """
    Validate data against a schema.

    Args:
        data: Dict or JSON string to validate
        schema_class: Pydantic model to validate against

    Returns:
        (is_valid, validated_object, error_message)
    """
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
    """Convert Pydantic model to dict."""
    return pydantic_obj.model_dump(exclude_none=True)


def to_json(pydantic_obj: BaseModel, indent: int = 2) -> str:
    """Convert Pydantic model to JSON string."""
    return pydantic_obj.model_dump_json(indent=indent, exclude_none=True)