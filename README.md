# Clarix — AI-Powered Study Platform

> RAG-based academic assistant with adaptive quizzing, weakness detection, and a personalised revision planner.

![Tech Stack](https://img.shields.io/badge/FastAPI-Backend-009688?style=flat) ![Next.js](https://img.shields.io/badge/Next.js-Frontend-000000?style=flat) ![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_DB-orange?style=flat) ![Docker](https://img.shields.io/badge/Docker-Containerised-2496ED?style=flat)

## Live Demo
🔗 Live demo coming soon

## What is Clarix?
Clarix is a full-stack AI study platform that helps students learn smarter. Upload your study material, get RAG-grounded explanations, take adaptive quizzes, and let the AI identify your weak areas and build a personalised revision plan.

## Architecture
| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | FastAPI, PostgreSQL, Redis |
| AI / RAG | OpenAI API, LangChain, ChromaDB |
| DevOps | Docker, Nginx, GitHub Actions, Locust |

## Key Features
- PDF ingestion → ChromaDB vector indexing → RAG-based Q&A
- LLM-powered adaptive quiz generation
- Structured weakness detection feeding a personalised planner
- Gamification: XP, streaks, referral system
- Production-ready: JWT auth (httpOnly cookies), Redis caching, brute-force lockout, email verification, CI/CD

## Local Setup
```bash
git clone https://github.com/Abhimanyu2004/scholarlyai
cp .env.example .env        # fill in your keys
docker-compose up --build
```

## Project Structure
backend/      # FastAPI app — routes, services, RAG pipeline

frontend/     # Next.js app

chroma_db/    # Vector store (local, not tracked)

load_tests/   # Locust load testing config

.github/      # CI/CD workflows

## Status
🚧 Beta — actively developed.