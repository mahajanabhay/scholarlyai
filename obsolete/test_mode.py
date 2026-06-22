from openai import OpenAI
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from http import client
from http.client import HTTPException

load_dotenv()
from backend.core.config import client

# Load our PDF knowledge base from Day 3
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_db = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)

def generate_test_question(topic):
    """Retrieves context and generates a 1-question test."""
    docs = vector_db.similarity_search(topic, k=1)
    context = docs[0].page_content
    
    prompt = f"""
    Context: {context}
    Task: Based on the context above, generate ONE challenging Multiple Choice Question (MCQ).
    Provide 4 options (A, B, C, D). 
    Do NOT provide the answer yet.
    """
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": "You are an Exam Creator."},
                  {"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content, context

def evaluate_answer(question, user_answer, correct_context):
    """Checks the user's answer and provides feedback."""
    prompt = f"""
    Question: {question}
    User's Answer: {user_answer}
    Correct Context: {correct_context}
    
    Task: Grade the user. 
    1. Tell them if they are Correct or Incorrect.
    2. Provide a 'Mastery Score' out of 100.
    3. Explain WHY the correct answer is right.
    """
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": "You are a Strict Evaluator."},
                  {"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# --- SIMULATING A TEST SESSION ---
print("--- TEST MODE INITIALIZED ---")
topic_to_test = "Photosynthesis" # Change this to a topic in your PDF
question, context = generate_test_question(topic_to_test)

print(f"\nAI QUESTION:\n{question}")

# In a real app, this comes from the user's input box
user_input = input("\nYour Answer (e.g., A): ") 

print("\n--- EVALUATION ---")
feedback = evaluate_answer(question, user_input, context)
print(feedback)