"""
engine_refactored.py — Refactored Study-Only AI with JSON schema validation.

Key improvements:
- AcademicExplanation schema for structured responses
- SimplifiedConcept schema for simplifications
- Retry logic with fallback recovery
- Elimination of freeform text parsing
- Full type safety and validation
"""

import json
from typing import Optional
import logging

from backend.core.llm import client, LLM_MODEL
from backend.llm_output_handler import LLMOutputHandler, LLMOutputValidationError
from backend.schemas import AcademicExplanation, SimplifiedConcept

logger = logging.getLogger(__name__)

ACADEMIC_SYSTEM_PROMPT = """
You are a 'Study-Only AI'. You follow these strict rules:

1. TOPIC LOCK: If the user gives a short command like 'Simplify', 'Explain', or 'Give an example',
   apply it to the PREVIOUS academic topic discussed. Do not define the word itself.

2. ANTI-REPETITION: If the user asks to 'Simplify' or 'Explain' again:
   - READ your previous response in the chat history.
   - DO NOT repeat the same analogies, examples, or phrasing.
   - USE a completely different approach.

3. STUDY GUARD: If the user asks about anything non-academic (celebrities, cooking, jokes, etc.),
   respond with: "I focus only on academic learning. Would you like help with a study concept instead?"

4. RESPONSE STRUCTURE: Every academic response MUST be valid JSON matching the schema.
"""

EXPLAIN_PROMPT_TEMPLATE = """
Topic: {topic}
User Request: {user_request}

Previous context (if any):
{history}

Respond with a JSON object containing:
- concept: The topic name
- explanation: Clear, detailed explanation (main idea)
- key_points: List of 3-5 important points (as array of strings)
- real_world_example: Practical, real-world example
- practice_question: A question to test understanding

Example format:
{{
    "concept": "Photosynthesis",
    "explanation": "The process by which plants convert light energy...",
    "key_points": ["Uses sunlight", "Produces glucose", "Releases oxygen"],
    "real_world_example": "When you see green plants thriving in sunlight...",
    "practice_question": "What is the primary input for photosynthesis?"
}}

Respond ONLY with valid JSON.
"""

SIMPLIFY_PROMPT_TEMPLATE = """
Topic: {topic}
Simplification Level: {simplification_level}

Previous explanation (to avoid repetition):
{previous_explanation}

Respond with a JSON object containing:
- original_concept: The topic being simplified
- simplified_explanation: Much simpler explanation (avoid jargon)
- analogy: A completely DIFFERENT analogy than any used before
- difficulty_level: "beginner", "intermediate", or "advanced"
- key_takeaway: Single most important point

Example format:
{{
    "original_concept": "Photosynthesis",
    "simplified_explanation": "Plants are like tiny factories that use sunlight to make food...",
    "analogy": "Similar to how a solar panel converts sunlight into electricity",
    "difficulty_level": "beginner",
    "key_takeaway": "Plants use sunlight to grow"
}}

Respond ONLY with valid JSON.
"""


class StudyOnlyAI:
    """
    Refactored Study-Only AI with structured JSON outputs and validation.
    """

    def __init__(self, max_retries: int = 3):
        """Initialize with output handler."""
        self.output_handler = LLMOutputHandler(
            max_retries=max_retries, enable_fallback=True
        )
        self.max_retries = max_retries

    async def explain_topic(
        self, topic: str, user_request: str, history: Optional[list] = None
    ) -> AcademicExplanation:
        """
        Generate structured explanation for a topic.

        Args:
            topic: The academic topic to explain
            user_request: The user's specific request (e.g., "Explain", "Give example")
            history: Previous chat history for context

        Returns:
            AcademicExplanation object with validated structure

        Raises:
            LLMOutputValidationError: If explanation cannot be validated
        """
        if history is None:
            history = []

        # Build context from history
        history_text = "\n".join(
            [
                f"{msg['role'].upper()}: {msg['content'][:100]}"
                for msg in history[-4:]  # Last 4 messages
            ]
        )

        prompt = EXPLAIN_PROMPT_TEMPLATE.format(
            topic=topic,
            user_request=user_request,
            history=history_text or "None",
        )

        messages = [
            {"role": "system", "content": ACADEMIC_SYSTEM_PROMPT},
            *history,
            {"role": "user", "content": prompt},
        ]

        try:
            success, explanation, raw_output = await self.output_handler.validate_and_retry(
                client=client,
                model=LLM_MODEL,
                messages=messages,
                schema=AcademicExplanation,
                temperature=0.3,
                max_tokens=800,
            )

            if success:
                logger.info(f"✅ Explanation validated for topic: {topic}")
                return explanation
            else:
                raise LLMOutputValidationError(
                    f"Failed to validate explanation",
                    last_output=raw_output,
                )

        except LLMOutputValidationError as e:
            logger.error(f"❌ Explain failed after retries: {e}")
            raise

    async def simplify_concept(
        self,
        topic: str,
        previous_explanation: str = "",
        simplification_level: str = "beginner",
    ) -> SimplifiedConcept:
        """
        Generate a simplified version of a concept with different approach.

        Args:
            topic: The concept to simplify
            previous_explanation: Previous explanation to avoid repetition
            simplification_level: "beginner", "intermediate", or "advanced"

        Returns:
            SimplifiedConcept with validated structure

        Raises:
            LLMOutputValidationError: If simplification cannot be validated
        """
        prompt = SIMPLIFY_PROMPT_TEMPLATE.format(
            topic=topic,
            simplification_level=simplification_level,
            previous_explanation=previous_explanation[:500],
        )

        messages = [
            {"role": "system", "content": ACADEMIC_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            success, simplified, raw_output = await self.output_handler.validate_and_retry(
                client=client,
                model=LLM_MODEL,
                messages=messages,
                schema=SimplifiedConcept,
                temperature=0.4,
                max_tokens=600,
            )

            if success:
                logger.info(f"✅ Simplification validated for topic: {topic}")
                return simplified
            else:
                raise LLMOutputValidationError(
                    f"Failed to validate simplification",
                    last_output=raw_output,
                )

        except LLMOutputValidationError as e:
            logger.error(f"❌ Simplify failed after retries: {e}")
            raise

    # ════════════════════════════════════════════════════════════════════════════
    # LEGACY SYNCHRONOUS INTERFACE (for CLI testing)
    # ════════════════════════════════════════════════════════════════════════════

    def explain_topic_sync(
        self, topic: str, user_request: str, history: Optional[list] = None
    ) -> AcademicExplanation:
        """Synchronous wrapper for CLI use."""
        import asyncio

        try:
            return asyncio.run(
                self.explain_topic(topic, user_request, history)
            )
        except LLMOutputValidationError:
            logger.error("Explanation generation failed")
            # Return a minimal valid object
            return AcademicExplanation(
                concept=topic,
                explanation="Unable to generate explanation. Please try again.",
                key_points=["Try rephrasing your question"],
                real_world_example="",
                practice_question="",
            )

    def simplify_topic_sync(
        self, topic: str, previous_explanation: str = ""
    ) -> SimplifiedConcept:
        """Synchronous wrapper for CLI use."""
        import asyncio

        try:
            return asyncio.run(
                self.simplify_concept(topic, previous_explanation)
            )
        except LLMOutputValidationError:
            logger.error("Simplification generation failed")
            return SimplifiedConcept(
                original_concept=topic,
                simplified_explanation="Unable to simplify. Please try again.",
                analogy="",
                difficulty_level="beginner",
                key_takeaway="",
            )


# ════════════════════════════════════════════════════════════════════════════
# CLI TESTING
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    ai = StudyOnlyAI(max_retries=3)
    history = []

    print("🎓 STUDY-ONLY AI (Refactored with JSON Validation)\n")
    print("=" * 60)

    # Test 1: Explain Photosynthesis
    print("\n--- TEST 1: Explain Photosynthesis ---")
    try:
        explanation = ai.explain_topic_sync(
            "Photosynthesis",
            "Explain in simple terms",
            history,
        )
        print(f"✅ Concept: {explanation.concept}")
        print(f"📝 Explanation: {explanation.explanation[:200]}...")
        print(f"🔑 Key Points: {explanation.key_points}")

        # Add to history
        history.append({"role": "user", "content": "Explain Photosynthesis"})
        history.append({"role": "assistant", "content": explanation.model_dump_json()})

    except Exception as e:
        print(f"❌ Error: {e}")

    # Test 2: Simplify
    print("\n--- TEST 2: Simplify Photosynthesis ---")
    try:
        simplified = ai.simplify_topic_sync(
            "Photosynthesis",
            previous_explanation=explanation.explanation,
        )
        print(f"✅ Original: {simplified.original_concept}")
        print(f"📝 Simplified: {simplified.simplified_explanation[:200]}...")
        print(f"💡 Analogy: {simplified.analogy}")
        print(f"🎯 Key Takeaway: {simplified.key_takeaway}")

    except Exception as e:
        print(f"❌ Error: {e}")

    print("\n" + "=" * 60)
    print("✅ Tests completed!")