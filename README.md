# Clarix

> **An AI-powered study companion that helps students learn, practice, revise, and improve through adaptive learning, intelligent quizzes, personalized study plans, and Retrieval-Augmented Generation (RAG).**

**Live Demo:** https://clarix.vercel.app *(Update if your production URL changes)*

---

# Overview

Clarix is a full-stack AI learning platform built to provide students with a personalized and distraction-free study experience.

Unlike general-purpose AI chatbots, Clarix is designed specifically for education. It combines conversational AI, Retrieval-Augmented Generation (RAG), adaptive quizzes, progress tracking, study planning, and gamification into a single platform.

The platform is currently deployed in production using:

* **Frontend:** Vercel
* **Backend:** Railway
* **Vector Database:** ChromaDB
* **Database:** PostgreSQL
* **Caching:** Redis (configured)
* **Analytics:** Plausible Analytics

---

# Features

## AI Study Assistant

* Study-only AI assistant
* Context-aware conversations
* Streaming responses
* Markdown rendering
* Mathematical equation support (KaTeX)
* Code syntax highlighting
* Session-based chat history
* Conversation memory
* File upload support
* Study mode separation

---

## Retrieval-Augmented Generation (RAG)

Students can upload study material which becomes searchable by the AI.

Current implementation includes:

* PDF ingestion
* Vector embeddings
* Semantic search
* Context injection
* Knowledge management
* Document deletion
* Multiple document support

---

## Intelligent Quiz System

Clarix includes an adaptive quiz engine.

Features:

* Single-question mode
* Question paper generation
* Adaptive questioning
* Answer evaluation
* Feedback generation
* Retry weak topics
* Practice sessions
* Weakness detection
* Quiz history

---

## Weakness Tracking

Instead of only showing scores, Clarix identifies concepts where a student repeatedly struggles.

Features include:

* Weak topic detection
* Topic-based revision
* Retry quizzes
* Weakness statistics
* Progress monitoring

---

## Study Planner

Students can manage daily study goals.

Current capabilities:

* Manual task creation
* AI-generated study plans
* Daily planner
* Task completion tracking
* Verification workflow
* Progress monitoring

---

## User Profiles

Every user has a personalized profile including:

* Avatar system
* Bio
* Subject preferences
* XP
* Levels
* Streaks
* Weekly progress
* Achievement tracking

---

## Gamification

Clarix encourages consistent studying through:

* XP system
* Level progression
* Daily streaks
* Unlockable avatars
* Milestone rewards
* Progress bars
* Achievement notifications

---

## Notifications

Users receive notifications for:

* Milestones
* XP rewards
* Study reminders
* Planner updates
* System events

---

## Authentication

Authentication system includes:

* User registration
* Login
* JWT authentication
* Email verification
* Password reset
* Change password
* Referral support
* Protected routes
* Session validation

---

## Admin Features

Current admin functionality includes:

* User management
* Audit logs
* Platform statistics
* Admin panel
* Role management

---

## Analytics

Integrated analytics include:

* Plausible Analytics
* User events
* Quiz analytics
* Study tracking

---

# Technology Stack

## Frontend

* Next.js
* React
* JavaScript
* Tailwind CSS v4
* React Markdown
* KaTeX
* Lucide Icons

---

## Backend

* Python
* FastAPI
* Uvicorn

---

## AI Stack

* Groq API
* Llama 3.3 70B
* LangChain
* HuggingFace Embeddings
* ChromaDB

---

## Database

* PostgreSQL
* Redis (configured)

---

## Infrastructure

Frontend:

* Vercel

Backend:

* Railway

Analytics:

* Plausible

---

# Project Structure

```
Frontend
│
├── Pages
├── Dashboard
├── Authentication
├── Profile
├── Planner
├── Quiz
├── Knowledge Base
├── Notifications
├── Markdown Components
├── Hooks
├── Context
└── Common Components

Backend
│
├── Authentication
├── Chat
├── Quiz
├── Study
├── Profile
├── Knowledge
├── Services
├── Database
├── AI Engine
├── Memory
├── Vector Search
└── Tests
```

---

# Architecture

```
Student
    │
    ▼
Next.js Frontend
    │
    ▼
FastAPI Backend
    │
    ├────────────── PostgreSQL
    │
    ├────────────── Redis
    │
    ├────────────── ChromaDB
    │
    └────────────── Groq API
```

---

# Current Implemented Modules

* Authentication
* AI Chat
* RAG
* Knowledge Base
* Quiz Engine
* Weakness Tracker
* Study Sessions
* AI Planner
* Notifications
* XP System
* Levels
* Streaks
* Admin Dashboard
* Analytics
* Session Management
* Profile Management
* Email Verification
* Password Reset

---

# Testing

Current test coverage includes:

* Authentication
* Chat Routes
* Knowledge Routes
* Memory Service
* Notifications
* Profile Routes
* Quiz Routes
* Usage Service
* UI Components
* Load Testing using Locust

---

# Deployment

Frontend

* Hosted on **Vercel**

Backend

* Hosted on **Railway**

Environment variables are stored securely on the deployment platforms and are **not committed** to the repository.

---

# Future Roadmap

## Academic

* Multi-subject learning paths
* Flashcards
* Notes generation
* Mind maps
* PDF annotations

## AI

* Better long-term memory
* Personalized recommendations
* Multi-agent workflows
* Improved reasoning
* Voice interactions

## Collaboration

* Study groups
* Shared workspaces
* Leaderboards
* Classroom mode

## Platform

* Mobile application
* Offline support
* Multi-language support
* Calendar integrations

---

# Security

Clarix follows several security practices:

* JWT authentication
* Protected API routes
* Password hashing
* Email verification
* Request rate limiting
* Input validation
* Authorization middleware
* Environment-based secrets
* Secure deployment on Railway and Vercel

---

# Disclaimer

Clarix is an educational platform intended to assist students in learning. AI-generated responses should be verified against trusted academic sources when used for examinations or critical work.

---

# Author

**Abhay Mahajan**

B.Tech Artificial Intelligence & Machine Learning

Built as a production-ready AI-powered learning platform with a focus on adaptive education, personalization, and scalable architecture.
