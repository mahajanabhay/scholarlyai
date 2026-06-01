import os
from openai import OpenAI
from dotenv import load_dotenv
from http import client
from http.client import HTTPException

# Load the API key from the .env file
load_dotenv()
from backend.core.config import client

def study_guard(user_input):
    """Detects if the user's intent is academic."""
    
    system_instruction = (
        "You are an Academic Guard. You only allow questions related to school, "
        "university, or competitive exams. If the question is off-topic (e.g., jokes, "
        "cooking, sports), respond with the word 'REJECTED'. If it is academic, "
        "respond with 'ACCEPTED'."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_input}
        ]
    )
    
    return response.choices[0].message.content

# --- TEST THE GUARD ---
test_query = "How do I make a chocolate cake?"
print(f"Testing Query: {test_query}")
print(f"Result: {study_guard(test_query)}")