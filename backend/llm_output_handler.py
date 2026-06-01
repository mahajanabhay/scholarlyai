"""
llm_output_handler.py — Unified handler for LLM outputs with JSON validation,
retry logic, and fallback parsing recovery.

This module provides:
- Structured JSON extraction from LLM responses
- Schema validation with Pydantic
- Retry-on-invalid-JSON with escalating strategies
- Fallback parsing for partial recovery
- Logging and error tracking
"""

import json
import re
import asyncio
from typing import Optional, Type, Tuple, Any
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class LLMOutputValidationError(Exception):
    """Raised when LLM output cannot be validated after retries."""
    def __init__(self, message: str, last_output: str = "", retry_count: int = 0):
        super().__init__(message)
        self.last_output = last_output
        self.retry_count = retry_count


class LLMOutputHandler:
    """
    Handles LLM outputs with validation, retry logic, and fallback recovery.

    Workflow:
    1. Extract JSON from response (handling markdown, backticks, etc.)
    2. Validate against schema
    3. If invalid: retry with explicit JSON instruction (up to max_retries)
    4. If still invalid: attempt fallback parsing and data recovery
    5. Log all failures for debugging
    """

    def __init__(self, max_retries: int = 3, enable_fallback: bool = True):
        """
        Initialize handler.

        Args:
            max_retries: Maximum number of retries on JSON validation failure
            enable_fallback: Whether to attempt fallback parsing recovery
        """
        self.max_retries = max_retries
        self.enable_fallback = enable_fallback
        self.retry_history = []

    async def validate_and_retry(
        self,
        client: Any,
        model: str,
        messages: list,
        schema: Type[BaseModel],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> Tuple[bool, Optional[BaseModel], str]:
        """
        Call LLM and validate output against schema with retry logic.

        Args:
            client: OpenAI client
            model: Model name (e.g., 'gpt-4')
            messages: Message list for API
            schema: Pydantic schema to validate against
            temperature: LLM temperature
            max_tokens: Max tokens for response

        Returns:
            (success: bool, validated_object: BaseModel | None, raw_output: str)
        """
        raw_output = ""
        retry_count = 0

        # ════════════════════════════════════════════════════════════════
        # ATTEMPT 1: Standard call with structured output instruction
        # ════════════════════════════════════════════════════════════════
        try:
            # Add JSON instruction to system prompt
            enhanced_messages = self._inject_json_instruction(messages, schema)

            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=model,
                messages=enhanced_messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            raw_output = response.choices[0].message.content.strip()

            # Try to validate
            is_valid, obj, error_msg = self._validate_json_response(raw_output, schema)
            if is_valid:
                logger.info(f"✅ Output validated on first attempt for {schema.__name__}")
                return True, obj, raw_output

            logger.warning(f"⚠️  First attempt validation failed: {error_msg}")

        except Exception as e:
            logger.error(f"❌ LLM API call failed: {e}")
            raw_output = ""

        # ════════════════════════════════════════════════════════════════
        # RETRIES: Escalating correction strategies
        # ════════════════════════════════════════════════════════════════
        for retry_count in range(1, self.max_retries + 1):
            try:
                # Escalate strategy based on retry count
                correction_strategy = self._get_correction_strategy(
                    retry_count, schema, raw_output
                )

                retry_messages = self._build_retry_messages(
                    messages, raw_output, schema, correction_strategy, retry_count
                )

                response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=model,
                    messages=retry_messages,
                    temperature=0.3 + (retry_count * 0.1),  # Slightly higher temp
                    max_tokens=max_tokens,
                )
                raw_output = response.choices[0].message.content.strip()

                is_valid, obj, error_msg = self._validate_json_response(raw_output, schema)
                if is_valid:
                    logger.info(f"✅ Output validated on retry {retry_count} for {schema.__name__}")
                    return True, obj, raw_output

                logger.warning(f"⚠️  Retry {retry_count} failed: {error_msg}")

            except Exception as e:
                logger.error(f"❌ Retry {retry_count} failed with error: {e}")

        # ════════════════════════════════════════════════════════════════
        # FALLBACK: Attempt partial recovery from malformed JSON
        # ════════════════════════════════════════════════════════════════
        if self.enable_fallback:
            logger.info(f"🔧 Attempting fallback parsing for {schema.__name__}...")
            recovered_obj = self._attempt_fallback_recovery(raw_output, schema)
            if recovered_obj:
                logger.info(f"✅ Recovered object via fallback parsing")
                return True, recovered_obj, raw_output

        # ════════════════════════════════════════════════════════════════
        # FAILURE: All retries and fallback exhausted
        # ════════════════════════════════════════════════════════════════
        logger.error(
            f"❌ Failed to validate {schema.__name__} after {self.max_retries} retries"
        )
        raise LLMOutputValidationError(
            f"Failed to validate {schema.__name__} after {self.max_retries} retries",
            last_output=raw_output,
            retry_count=retry_count,
        )

    # ════════════════════════════════════════════════════════════════════
    # PRIVATE HELPERS
    # ════════════════════════════════════════════════════════════════════

    def _inject_json_instruction(self, messages: list, schema: Type[BaseModel]) -> list:
        """Inject JSON formatting instruction into system prompt."""
        enhanced = messages.copy()

        json_instruction = f"""
You MUST respond with ONLY valid JSON matching this schema:
{schema.model_json_schema()}

Requirements:
- Output ONLY the JSON object, no markdown, no backticks, no preamble
- Ensure all required fields are present
- Use proper JSON syntax (quotes, commas, brackets)
- No trailing commas
"""

        if enhanced and enhanced[0].get("role") == "system":
            enhanced[0]["content"] += "\n" + json_instruction
        else:
            enhanced.insert(0, {"role": "system", "content": json_instruction})

        return enhanced

    def _validate_json_response(
        self, raw_output: str, schema: Type[BaseModel]
    ) -> Tuple[bool, Optional[BaseModel], str]:
        """
        Extract and validate JSON from raw output.

        Returns:
            (is_valid, validated_obj, error_message)
        """
        try:
            # Try to extract JSON (handle markdown, backticks)
            json_str = self._extract_json(raw_output)
            data = json.loads(json_str)

            # Validate against schema
            obj = schema(**data)
            return True, obj, ""

        except json.JSONDecodeError as e:
            return False, None, f"Invalid JSON: {str(e)}"
        except Exception as e:
            return False, None, f"Validation error: {str(e)}"

    def _extract_json(self, text: str) -> str:
        """
        Extract JSON from text, handling markdown code blocks and other wrappers.

        Strategies:
        1. Look for ```json ... ``` blocks
        2. Look for {...} or [...] at start/end
        3. Find first { and last } and extract that range
        """
        text = text.strip()

        # Strategy 1: Markdown code block
        json_match = re.search(r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```', text, re.DOTALL)
        if json_match:
            return json_match.group(1)

        # Strategy 2: Explicit {...} or [...]
        if text.startswith('{') or text.startswith('['):
            # Find matching closing bracket
            return self._extract_matching_brackets(text)

        # Strategy 3: Search for first { and last }
        start_idx = text.find('{')
        if start_idx == -1:
            raise ValueError("No JSON object found in response")

        end_idx = text.rfind('}')
        if end_idx == -1:
            raise ValueError("No matching closing bracket found")

        return text[start_idx : end_idx + 1]

    def _extract_matching_brackets(self, text: str) -> str:
        """Extract JSON with matching brackets."""
        depth = 0
        start_char = text[0]
        end_char = '}' if start_char == '{' else ']'

        for i, char in enumerate(text):
            if char == start_char:
                depth += 1
            elif char == end_char:
                depth -= 1
                if depth == 0:
                    return text[: i + 1]

        raise ValueError("Unmatched brackets in JSON")

    def _get_correction_strategy(
        self, retry_count: int, schema: Type[BaseModel], last_output: str
    ) -> str:
        """Determine correction strategy based on retry count."""
        if retry_count == 1:
            return "strict_json"
        elif retry_count == 2:
            return "simplified_schema"
        else:
            return "minimal_fields"

    def _build_retry_messages(
        self,
        original_messages: list,
        last_output: str,
        schema: Type[BaseModel],
        strategy: str,
        retry_count: int,
    ) -> list:
        """Build messages for retry attempt with correction instruction."""
        messages = original_messages.copy()

        if strategy == "strict_json":
            correction = f"""
Your previous output was invalid JSON. Please retry and ensure:
1. Output ONLY valid JSON (no markdown, no backticks)
2. All strings use double quotes
3. No trailing commas
4. Proper nesting of objects and arrays
5. All required fields present

Last attempt: {last_output[:200]}...

Try again - output ONLY the JSON object:
"""
        elif strategy == "simplified_schema":
            correction = f"""
Your JSON structure was invalid. Please provide a simpler, valid JSON response.
Focus only on the core required fields:
{', '.join(schema.model_fields.keys())}

Output ONLY valid JSON with these fields:
"""
        else:  # minimal_fields
            correction = f"""
Please output valid JSON with at minimum these core fields:
{', '.join(list(schema.model_fields.keys())[:3])}

Use this exact template and fill in the values:
{self._get_minimal_template(schema)}
"""

        messages.append({"role": "assistant", "content": last_output})
        messages.append({"role": "user", "content": correction})

        return messages

    def _get_minimal_template(self, schema: Type[BaseModel]) -> str:
        """Generate a minimal JSON template for the schema."""
        fields = schema.model_fields
        template = {}

        for field_name, field_info in fields.items():
            if field_info.is_required():
                if "List" in str(field_info.annotation):
                    template[field_name] = []
                elif "str" in str(field_info.annotation).lower():
                    template[field_name] = "value"
                elif "int" in str(field_info.annotation).lower():
                    template[field_name] = 0
                else:
                    template[field_name] = "value"

        return json.dumps(template, indent=2)

    def _attempt_fallback_recovery(
        self, raw_output: str, schema: Type[BaseModel]
    ) -> Optional[BaseModel]:
        """
        Attempt to recover partial data from malformed JSON.

        Strategies:
        1. Fix common JSON errors (missing quotes, trailing commas)
        2. Extract key-value pairs and reconstruct
        3. Use field defaults where possible
        """
        try:
            # Strategy 1: Fix common issues
            cleaned = self._clean_json(raw_output)
            try:
                data = json.loads(cleaned)
                obj = schema(**data)
                return obj
            except:
                pass

            # Strategy 2: Extract and reconstruct
            extracted = self._extract_key_value_pairs(raw_output, schema)
            if extracted:
                obj = schema(**extracted)
                return obj

            return None

        except Exception as e:
            logger.debug(f"Fallback recovery failed: {e}")
            return None

    def _clean_json(self, text: str) -> str:
        """Fix common JSON errors."""
        # Remove comments
        text = re.sub(r'//.*?$', '', text, flags=re.MULTILINE)

        # Fix trailing commas
        text = re.sub(r',(\s*[}\]])', r'\1', text)

        # Fix single quotes to double quotes (careful not to break content)
        # This is risky but useful as fallback
        text = re.sub(r"'([^']*)'", r'"\1"', text)

        return text

    def _extract_key_value_pairs(self, text: str, schema: Type[BaseModel]) -> dict:
        """Extract key-value pairs from malformed text using field names."""
        result = {}
        fields = schema.model_fields

        for field_name in fields.keys():
            # Look for "field_name": value or field_name: value patterns
            patterns = [
                rf'"{field_name}"\s*:\s*"([^"]*)"',  # String value
                rf'"{field_name}"\s*:\s*(\d+)',  # Number value
                rf'{field_name}\s*:\s*"([^"]*)"',  # Unquoted field, string value
                rf'{field_name}\s*:\s*(\d+)',  # Unquoted field, number value
            ]

            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    result[field_name] = match.group(1)
                    break

        return result if result else None


# ════════════════════════════════════════════════════════════════════════════
# SYNCHRONOUS WRAPPER (for non-async contexts)
# ════════════════════════════════════════════════════════════════════════════

class SyncLLMOutputHandler(LLMOutputHandler):
    """Synchronous version for blocking code."""

    def validate_and_retry_sync(
        self,
        client: Any,
        model: str,
        messages: list,
        schema: Type[BaseModel],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> Tuple[bool, Optional[BaseModel], str]:
        """Synchronous version using asyncio.run()."""
        return asyncio.run(
            self.validate_and_retry(
                client, model, messages, schema, temperature, max_tokens
            )
        )