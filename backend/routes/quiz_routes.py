import asyncio
import uuid
from backend.core.config import MAX_TOKENS
from backend.core.llm import client, LLM_MODEL
import re
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, Depends, Request
from backend.core.limiter import limiter
from backend.core.jwt_auth import get_current_user

from backend.routes.chat_routes import NON_ACADEMIC_REPLY, is_academic_query
from backend.services.memory_service import push_notification, record_weakness
from backend.services.vector_service import get_quiz_memory, get_vector_db, reset_quiz_memory
from backend.db import get_connection, release_connection
from backend.services.usage_service import increment_usage, FREE_LIMITS


router = APIRouter()

ABBREVIATION_MAP = {
    # Computer Science & Artificial Intelligence
    "AI": "Artificial Intelligence",
    "ML": "Machine Learning",
    "NLP": "Natural Language Processing",
    "CV": "Computer Vision",
    "AIML": "Artificial Intelligence and Machine Learning",
    "DL": "Deep Learning",
    "RL": "Reinforcement Learning",
    "NNs": "Neural Networks",
    "LSTM": "Long Short-Term Memory",
    "GRU": "Gated Recurrent Unit",
    "CNN": "Convolutional Neural Networks",
    "RNN": "Recurrent Neural Networks",
    "GAN": "Generative Adversarial Networks",
    "VGG": "Visual Geometry Group Networks",
    "YOLO": "You Only Look Once",
    "ResNet": "Residual Network",
    "GPT": "Generative Pre-trained Transformer",
    "BERT": "Bidirectional Encoder Representations from Transformers",
    "LLM": "Large Language Model",
    "SVM": "Support Vector Machine",
    "KNN": "K-Nearest Neighbors",
    "PCA": "Principal Component Analysis",
    "ICA": "Independent Component Analysis",
    "SVD": "Singular Value Decomposition",
    "GMM": "Gaussian Mixture Model",
    
    # Web & Database Technologies
    "IOT": "Internet of Things",
    "IoT": "Internet of Things",
    "DB": "Database",
    "SQL": "Structured Query Language",
    "NoSQL": "NoSQL Databases",
    "RDBMS": "Relational Database Management System",
    "DBMS": "Database Management System",
    "ORM": "Object-Relational Mapping",
    "API": "Application Programming Interface",
    "REST": "Representational State Transfer",
    "JSON": "JavaScript Object Notation",
    "XML": "eXtensible Markup Language",
    "YAML": "YAML Ain't Markup Language",
    "HTML": "HyperText Markup Language",
    "CSS": "Cascading Style Sheets",
    "SCSS": "Sassy CSS",
    "LESS": "Leaner Style Sheets",
    "AJAX": "Asynchronous JavaScript and XML",
    "GraphQL": "Graph Query Language",
    "WebSocket": "WebSocket Protocol",
    "CORS": "Cross-Origin Resource Sharing",
    
    # Programming Concepts & Paradigms
    "OOP": "Object-Oriented Programming",
    "FP": "Functional Programming",
    "DSA": "Data Structures and Algorithms",
    "SOLID": "Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion",
    "DRY": "Don't Repeat Yourself",
    "KISS": "Keep It Simple, Stupid",
    "YAGNI": "You Aren't Gonna Need It",
    "MVC": "Model-View-Controller",
    "MVVM": "Model-View-ViewModel",
    "MVP": "Model-View-Presenter",
    "ACID": "Atomicity, Consistency, Isolation, Durability",
    
    # Data Science & Analytics
    "DS": "Data Science",
    "BDA": "Big Data Analytics",
    "ETL": "Extract, Transform, Load",
    "BI": "Business Intelligence",
    "OLAP": "Online Analytical Processing",
    "OLTP": "Online Transaction Processing",
    
    # Hardware & Infrastructure
    "CPU": "Central Processing Unit",
    "GPU": "Graphics Processing Unit",
    "TPU": "Tensor Processing Unit",
    "RAM": "Random Access Memory",
    "ROM": "Read-Only Memory",
    "SSD": "Solid State Drive",
    "HDD": "Hard Disk Drive",
    "BIOS": "Basic Input/Output System",
    
    # Networking & Security
    "HTTP": "Hypertext Transfer Protocol",
    "HTTPS": "Hypertext Transfer Protocol Secure",
    "TCP": "Transmission Control Protocol",
    "UDP": "User Datagram Protocol",
    "DNS": "Domain Name System",
    "SMTP": "Simple Mail Transfer Protocol",
    "POP": "Post Office Protocol",
    "IMAP": "Internet Message Access Protocol",
    "FTP": "File Transfer Protocol",
    "SFTP": "SSH File Transfer Protocol",
    "SSH": "Secure Shell",
    "SSL": "Secure Sockets Layer",
    "TLS": "Transport Layer Security",
    "VPN": "Virtual Private Network",
    "IPSec": "Internet Protocol Security",
    "LDAP": "Lightweight Directory Access Protocol",
    "OAuth": "Open Authorization",
    "JWT": "JSON Web Token",
    
    # Cloud & DevOps
    "AWS": "Amazon Web Services",
    "GCP": "Google Cloud Platform",
    "Azure": "Microsoft Azure",
    "CI": "Continuous Integration",
    "CD": "Continuous Deployment",
    "DevOps": "Development and Operations",
    "IaC": "Infrastructure as Code",
    "GitOps": "Git Operations",
    "Docker": "Docker Containerization",
    "K8s": "Kubernetes",
    "ECS": "Elastic Container Service",
    "EKS": "Elastic Kubernetes Service",
    "Lambda": "AWS Lambda",
    "Serverless": "Serverless Computing",
    
    # Version Control & Collaboration
    "Git": "Git Version Control System",
    "SVN": "Subversion",
    "VCS": "Version Control System",
    "PR": "Pull Request",
    "MR": "Merge Request",
    "CR": "Code Review",
    
    # Testing & Quality
    "TDD": "Test-Driven Development",
    "BDD": "Behavior-Driven Development",
    "QA": "Quality Assurance",
    "UAT": "User Acceptance Testing",
    "A/B": "A/B Testing",
    
    # Science & Medicine
    "DNA": "Deoxyribonucleic Acid",
    "RNA": "Ribonucleic Acid",
    "mRNA": "Messenger Ribonucleic Acid",
    "tRNA": "Transfer Ribonucleic Acid",
    "rRNA": "Ribosomal Ribonucleic Acid",
    "ATP": "Adenosine Triphosphate",
    "ADP": "Adenosine Diphosphate",
    "GTP": "Guanosine Triphosphate",
    "pH": "Potential of Hydrogen",
    "pKa": "Negative Logarithm of the Acid Dissociation Constant",
    "HCl": "Hydrochloric Acid",
    "NaCl": "Sodium Chloride",
    "H2O": "Water",
    "CO2": "Carbon Dioxide",
    "O2": "Oxygen",
    "N2": "Nitrogen",
    "NADH": "Nicotinamide Adenine Dinucleotide",
    "FADH2": "Flavin Adenine Dinucleotide",
    
    # Education Standards
    "GCE": "General Certificate of Education",
    "GCSE": "General Certificate of Secondary Education",
    "AP": "Advanced Placement",
    "IB": "International Baccalaureate",
    "SAT": "Scholastic Assessment Test",
    "ACT": "American College Testing",
    
    # Mathematics
    "Calculus": "Calculus",
    "PDEs": "Partial Differential Equations",
    "ODEs": "Ordinary Differential Equations",
    "FFT": "Fast Fourier Transform",
    "DFT": "Discrete Fourier Transform",
    "Matrix": "Matrix",
    "Algebra": "Algebra",
    "Geometry": "Geometry",
    "Trigonometry": "Trigonometry",
    "Statistics": "Statistics",
    "Probability": "Probability",
    
    # Other Common Abbreviations
    "NLP": "Natural Language Processing",
    "NLTK": "Natural Language Toolkit",
    "Regex": "Regular Expression",
    "GUI": "Graphical User Interface",
    "CLI": "Command Line Interface",
    "IDE": "Integrated Development Environment",
    "REPL": "Read-Eval-Print Loop",
    "SDK": "Software Development Kit",
    "Library": "Library",
    "Framework": "Framework",
}

def expand_abbreviations(topic: str) -> str:
    """
    Intelligently expand common academic and technical abbreviations to their full forms.
    
    Features:
    - Case-insensitive matching (handles 'ai', 'AI', 'Ai', etc.)
    - Multi-word topic support (expands each word independently)
    - Preserves unknown words/terms without alteration
    - Returns original topic if no abbreviations found
    
    Examples:
    - "ai" → "Artificial Intelligence"
    - "AI ML" → "Artificial Intelligence Machine Learning"
    - "machine learning" → "machine learning" (no change, already expanded)
    - "ai ml nlp" → "Artificial Intelligence Machine Learning Natural Language Processing"
    """
    if not topic or not isinstance(topic, str):
        return topic
    
    normalized = topic.strip()
    if not normalized:
        return topic
    
    # Split by common delimiters and spaces
    words = normalized.split()
    expanded_words = []
    
    for word in words:
        # Try to find exact case-insensitive match in abbreviation map
        found = False
        for abbr, full_form in ABBREVIATION_MAP.items():
            if word.lower() == abbr.lower():
                expanded_words.append(full_form)
                found = True
                print(f"✅ Expanded abbr: '{word}' → '{full_form}'")
                break
        
        # If not found in map, keep original word unchanged
        if not found:
            expanded_words.append(word)
    
    expanded_topic = " ".join(expanded_words)
    
    # Log expansion if it occurred
    if expanded_topic != normalized:
        print(f"📚 Topic expanded: '{normalized}' → '{expanded_topic}'")
    
    return expanded_topic


@router.post("/quiz")
@limiter.limit("20/minute")
async def quiz_endpoint(
    
    request: Request,
    message:          str           = Form(...),
    session_id:       str           = Form(...),
    previous_papers:  Optional[str] = Form(None),
    mode:            str           = Form(...),
    quiz_type:       str           = Form("single"),
    question_number: int           = Form(1),
    last_question:   Optional[str] = Form(None),
    is_starting:     str           = Form("false"),
    last_was_wrong:  str           = Form("false"),
    current_user:    dict          = Depends(get_current_user),
):
    """
    Enhanced Quiz endpoint with:
    - Repetition prevention and context awareness
    - Automatic abbreviation expansion for all quiz topics
    - Clean, detailed, exact explanations
    - Proper response structure for single MCQ and paper modes
    
    Modes:
    - quiz_type="single": One MCQ at a time with clickable options
    - quiz_type="paper": Full question paper (descriptive/short answer format)
    
    Features:
    - Records weaknesses when last_was_wrong=true
    - Prevents question repetition
    - Expands shortforms in any case (ai, AI, Ai → Artificial Intelligence)
    """
    try:
        session_id = session_id.replace("/", "_").replace("\\", "_").replace("..", "_")
        scoped_session_id = f"{current_user['user_id']}_{session_id}"
        quiz_mem = get_quiz_memory(scoped_session_id)
        is_quiz_start = is_starting.lower() == "true"
        # Enforce daily quiz limit on new quiz starts only
        if is_quiz_start:
            allowed = await asyncio.to_thread(increment_usage, current_user["user_id"], "quiz")
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily quiz limit of {FREE_LIMITS['quiz']} reached. Resets at midnight."
                )
        # ── Strict academic gate (only check when starting a new quiz topic) ──
        if is_quiz_start and not await asyncio.to_thread(is_academic_query, message):
            raise HTTPException(
                status_code=400,
                detail=NON_ACADEMIC_REPLY,
            )

        if is_quiz_start:
            # Expand abbreviations to their full forms (case-insensitive, multi-word support)
            expanded_topic = expand_abbreviations(message)
            quiz_mem["quiz_topic"] = expanded_topic
            quiz_mem["asked_questions"] = []
            quiz_mem["asked_topics"] = []
            print(f"✅ Quiz started on topic: '{message}' → Expanded: '{expanded_topic}'")

            print(f"📊 Weakness tracked for user '{current_user['user_id']}' in '{quiz_mem['quiz_topic']}'")

        feedback = ""
        if last_question and quiz_type == "single":
            grading_prompt = (
                f"Question: {last_question}\n"
                f"Student's answer: {message}\n\n"
                "Grade this answer:\n"
                "1. Provide 2-3 sentences explaining why the answer is right or wrong.\n"
                "2. Give a specific study tip if wrong, or explain the key concept if correct.\n"
                "3. End your response with EXACTLY one of these two lines:\n"
                "VERDICT: CORRECT\n"
                "VERDICT: INCORRECT\n"
                "Do not add anything after the VERDICT line."
            )
            eval_resp = await asyncio.to_thread(
                client.chat.completions.create,
                model=LLM_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a strict academic quiz grader. "
                            "Grade the student's answer and end your response with exactly one of:\n"
                            "VERDICT: CORRECT\n"
                            "VERDICT: INCORRECT\n"
                            "Never omit the VERDICT line. Never add text after it."
                        )
                    },
                    {"role": "user", "content": grading_prompt},
                ],
                max_tokens=MAX_TOKENS,
                temperature=0.2,  # Lower temperature for more consistent feedback
            )
            feedback = eval_resp.choices[0].message.content

        db = get_vector_db(f"user_{current_user['user_id']}")
        search_query = quiz_mem["quiz_topic"] if quiz_mem["quiz_topic"] else message
        docs = await asyncio.to_thread(db.similarity_search, search_query, k=4)
        context = "\n".join([doc.page_content for doc in docs])

        # ✅ QUESTION PAPER MODE
        if quiz_type == "paper" and is_quiz_start:
            match = re.search(r'(\d+)', message)
            num_questions = int(match.group(1)) if match else 10

            total_marks = num_questions * 4
            previously_used = (
                f"\n\nPREVIOUSLY GENERATED PAPERS (DO NOT REPEAT THESE QUESTIONS OR TOPICS):\n{previous_papers}\n\n"
                if previous_papers else ""
            )
            paper_prompt = (
                f"User instruction: {message}\n"
                f"{previously_used}"
                f"Topic: {quiz_mem['quiz_topic']}\n"
                f"Number of questions: {num_questions} | Total Marks: {total_marks} | Time: {num_questions * 10} minutes\n"
                f"Context: {context}\n\n"
                "STRICTLY follow any specific instructions given by the user above (question types, marks, sections, difficulty, etc).\n\n"
                "Format the paper EXACTLY like this — each question on its own line with a blank line between questions:\n\n"
                f"[SUBJECT] EXAMINATION\n"
                f"TIME: {num_questions * 10} MINUTES    TOTAL MARKS: {total_marks}\n\n"
                "SECTION A: SHORT ANSWER QUESTIONS\n\n"
                "Q1) [question text] (2 marks)\n\n"
                "Q2) [question text] (2 marks)\n\n"
                "SECTION B: DESCRIPTIVE QUESTIONS\n\n"
                "Q3) [question text] (4 marks)\n\n"
                "Rules:\n"
                "1. One question per line, blank line between each question\n"
                "2. Every question must show mark allocation e.g. (2 marks)\n"
                "3. No repeated concepts\n"
                "4. OUTPUT ONLY THE QUESTION PAPER — NO ANSWERS, NO NOTES\n\n"
                "Begin:"
            )

            paper_resp = await asyncio.to_thread(
                client.chat.completions.create,
                model=LLM_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert academic exam creator with 25+ years of experience. "
                            "Create rigorous, well-structured, professional question papers that test understanding "
                            "across multiple cognitive levels. Ensure questions are clear, varied, and progressively challenging. "
                            "Follow the exact format requested. NEVER include answers or solution keys."
                        )
                    },
                    {"role": "user", "content": paper_prompt},
                ],
                max_tokens=3000,
                temperature=0.5,
            )

            question_paper = paper_resp.choices[0].message.content
            quiz_mem["question_paper"] = question_paper

            # Persist to DB
            try:
                conn = get_connection()
                try:
                    cur = conn.cursor()
                    cur.execute(
                        """INSERT INTO question_papers (user_id, session_id, subject, content)
                           VALUES (%s, %s, %s, %s)""",
                        (current_user["user_id"], session_id, quiz_mem.get("quiz_topic"), question_paper)
                    )
                    conn.commit()
                finally:
                    release_connection(conn)
            except Exception as e:
                print(f"⚠️ Failed to persist question paper: {e}")

            return {
                "feedback":         "",
                "new_question":     question_paper,
                "question_number":  1,
                "quiz_type":        "paper",
                "is_paper_start":   True,
                "topic_expanded":   quiz_mem['quiz_topic'],
            }

        # ✅ SINGLE QUESTION MODE (MCQ)
        asked_summary = ""
        if quiz_mem["asked_questions"]:
            asked_summary = (
                "PREVIOUSLY ASKED QUESTIONS (NEVER ask similar or identical questions again):\n"
                + "\n".join([f"{i+1}. {q}" for i, q in enumerate(quiz_mem["asked_questions"])])
                + "\n\n"
            )

        quiz_prompt = (
            f"TOPIC: {quiz_mem['quiz_topic']}\n\n"
            f"{asked_summary}"
            f"AVAILABLE STUDY MATERIAL:\n{context}\n\n"
            "TASK: Generate ONE brand new multiple-choice question on the TOPIC.\n\n"
            "STRICT REQUIREMENTS:\n"
            "1. Question MUST test a UNIQUE, DISTINCT aspect/concept of the main topic.\n"
            "2. NEVER generate a question similar to or identical with previously asked questions.\n"
            "3. Ensure NO repetition: different subject matter, different concept tested, different wording.\n"
            "4. Each question must progressively test DIFFERENT key concepts from the topic.\n"
            "5. Make questions progressively harder: Question N should be harder than Question N-1.\n"
            "6. Ensure maximum conceptual variety across all questions.\n"
            "7. Use provided study material first; use your knowledge if material insufficient.\n"
            "8. Questions must be clear, academically rigorous, unambiguous, and well-formed.\n"
            "9. All options (A, B, C, D) must be plausible but only ONE correct answer.\n\n"
            "FORMAT (EXACT - NO DEVIATIONS):\n"
            f"Q{question_number}) [Complete, well-formed question text ending with ?]\n"
            "A) [Plausible option]\n"
            "B) [Plausible option]\n"
            "C) [Plausible option]\n"
            "D) [Plausible option]\n"
            "ANSWER: [The letter of the correct option - randomise which letter is correct]\n\n"
            "⚠️ OUTPUT ONLY THE QUESTION, 4 OPTIONS, AND ANSWER LINE. NO MARKDOWN. NO EXPLANATIONS. NO EXTRA TEXT."
        )

        new_q_resp = await asyncio.to_thread(
            client.chat.completions.create,
            model=LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert academic exam creator with 25+ years of experience creating rigorous exams. "
                        "You SPECIALIZE in generating UNIQUE, VARIED, ACADEMICALLY RIGOROUS multiple-choice questions. "
                        "Your PRIMARY DUTY is to NEVER repeat a question or test the same concept twice. "
                        "Each question MUST test a DIFFERENT aspect of the topic. "
                        "You MUST provide EXACT, CLEAN, WELL-FORMED questions without any deviation from format. "
                        "All output must be academically sound with no misleading or incorrect information. "
                        "Absolute strict adherence to format is mandatory. No markdown. No explanations. No extra content."
                    )
                },
                {"role": "user", "content": quiz_prompt},
            ],
            max_tokens=MAX_TOKENS,
            temperature=0.7,
        )

        new_question = new_q_resp.choices[0].message.content

        question_summary = new_question.split("\n")[0].replace(f"Q{question_number}) ", "").strip()
        quiz_mem["asked_questions"].append(question_summary)
        print(f"✅ Question {question_number} generated on [{quiz_mem['quiz_topic']}]: {question_summary[:100]}")

        # Award streak for verified quiz activity
        try:
            from backend.services.memory_service import touch_streak
            await asyncio.to_thread(touch_streak, current_user["user_id"])
        except Exception:
            pass

        try:
            from backend.db import record_progress
            await asyncio.to_thread(record_progress, current_user["user_id"], 1)
        except Exception:
            pass

        is_correct = ("verdict: correct" in feedback.lower()) if feedback else None

        # Record weakness immediately using THIS request's grading result
        if is_correct is False and last_question and quiz_mem.get("quiz_topic"):
            await asyncio.to_thread(
                record_weakness,
                current_user["user_id"],
                quiz_mem["quiz_topic"],
                last_question,
            )
            await asyncio.to_thread(
                push_notification,
                current_user["user_id"],
                f"🎯 Weakness recorded in '{quiz_mem['quiz_topic']}' — auto-revision scheduled.",
                "warning",
            )

        return {
            "feedback":        feedback,
            "new_question":    new_question,
            "question_number": question_number,
            "is_correct":      is_correct,
            "quiz_type":       "single",
            "is_paper_start":  False,
            "topic_expanded":  quiz_mem['quiz_topic'],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in /quiz: {e}")
        error_msg = "⚠️ Error processing quiz. Please check your connection and try again."
        return {
            "feedback": error_msg,
            "new_question": f"[Error] Could not generate next question. Please retry or start a new topic.\nError details: {str(e)[:80]}",
            "question_number": question_number,
            "quiz_type": "single",
            "is_paper_start": False,
            "error": True,
        }


@router.post("/quiz/answers")
@limiter.limit("10/minute")
async def get_answers_endpoint(
    request: Request,
    session_id:    str           = Form(...),
    paper_content: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Retrieve answers for the current question paper.
    Called when user requests to see answers.
    """
    try:
        session_id = session_id.replace("/", "_").replace("\\", "_").replace("..", "_")
        scoped_session_id = f"{current_user['user_id']}_{session_id}"
        quiz_mem = get_quiz_memory(scoped_session_id)
        
        if not quiz_mem["quiz_topic"]:
            raise HTTPException(status_code=400, detail="No active quiz session")

        db = get_vector_db(f"user_{current_user['user_id']}")
        search_query = quiz_mem["quiz_topic"]
        docs = await asyncio.to_thread(db.similarity_search, search_query, k=5)
        context = "\n".join([doc.page_content for doc in docs])

        question_paper = paper_content or quiz_mem.get("question_paper", "")
        if not question_paper:
            raise HTTPException(status_code=400, detail="No question paper found for this session")

        answers_prompt = (
            f"Topic: {quiz_mem['quiz_topic']}\n"
            f"Context: {context}\n\n"
            f"Here is the exam question paper:\n{question_paper}\n\n"
            "Provide comprehensive model answers ONLY for the questions listed above.\n"
            "Format each answer clearly with the matching question number (e.g. Q1, Q2...).\n"
            "Be detailed and accurate in your explanations."
        )

        answers_resp = await asyncio.to_thread(
            client.chat.completions.create,
            model=LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert educator providing model answers to exam questions. Be comprehensive and accurate."
                },
                {"role": "user", "content": answers_prompt},
            ],
            max_tokens=3000,
        )

        return {
            "answers": answers_resp.choices[0].message.content,
        }

    except Exception as e:
        print(f"CRITICAL ERROR in /quiz/answers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/reset")
@limiter.limit("20/minute")
async def reset_quiz_endpoint(
    request: Request,
    session_id:   str  = Form(...),
    current_user: dict = Depends(get_current_user),
):
    session_id = session_id.replace("/", "_").replace("\\", "_").replace("..", "_")
    reset_quiz_memory(session_id)
    return {"status": "quiz_memory_cleared"}

@router.post("/quiz/session")
async def create_quiz_session(current_user=Depends(get_current_user)):
    return {"session_id": str(uuid.uuid4())}