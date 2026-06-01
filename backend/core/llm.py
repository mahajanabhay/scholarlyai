from openai import OpenAI
from backend.core.config import GROQ_API_KEY, LLM_MODEL

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)