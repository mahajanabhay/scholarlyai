# LEGACY FILE — not imported by any route. Do not delete (referenced in git history).
# Do not run directly in production.
import os
from openai import OpenAI
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from http import client
from http.client import HTTPException

load_dotenv()
from backend.core.config import client

# Load the "Brain" we created in Step 4
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_db = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)

def scholarly_rag_chat(user_query, history=[]):
    # 1. Search the PDF for relevant text
    search_results = vector_db.similarity_search(user_query, k=2)
    source_context = "\n".join([res.page_content for res in search_results])

    # 2. Build the Prompt (Including the PDF data)
    system_prompt = f"""
    You are a 'Study-Only AI'. 
    USE THE FOLLOWING CONTEXT FROM THE TEXTBOOK TO ANSWER:
    {source_context}
    
    RULES:
    - If the answer isn't in the context, say "I can't find that in your notes."
    - Follow the Study Guard and Anti-Repetition rules discussed previously.
    """

    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_query}]
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )
    return response.choices[0].message.content

# TEST IT
print(scholarly_rag_chat("What is the main topic of page 1?"))