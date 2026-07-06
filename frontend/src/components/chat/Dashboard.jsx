"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import QuestionPaperView from "@/components/quiz/QuestionPaperView";
import XPBar from "@/components/common/XPBar";
import ProfilePanel from "@/components/profile/ProfilePanel";
import PlannerPanel from "@/components/planner/PlannerPanel";
import WeaknessPanel from "@/components/profile/WeaknessPanel";
import NotificationsPanel from "@/components/profile/NotificationsPanel";
import KnowledgePanel from "@/components/panel/KnowledgePanel";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import AdminPanel from "@/components/admin/AdminPanel";

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  Send, Paperclip, X, Sun, Moon, GraduationCap, User, Bot, LogOut, Settings, MoreHorizontal,
  Plus, Menu, ChevronDown, Eye, Search, Timer, Bookmark, BookmarkCheck, Copy, Check,
  RotateCcw, Pencil, Clock, Coffee,
  Code2, Zap, Star, Flame, Trophy, Bell, BellOff, Calendar,
  Trash2, RefreshCw, AlertTriangle, ChevronRight, BookOpen,
  CheckCircle2, Circle, BarChart2, Shield, LineChart, TrendingUp
} from 'lucide-react';
import {
  mdComponents,
  codeMdComponents,
} from "@/components/markdown/markdownComponents";
import EmptyStateActions from "@/components/chat/EmptyStateActions";
import QuizCard from "@/components/quiz/QuizCard";
import FeedbackCard from "@/components/quiz/FeedbackCard";
import PomodoroTimer from "@/components/common/PomodoroTimer";
import { API_URL, apiFetch } from "@/lib/api";
import { useQuiz } from "@/hooks/useQuiz";
import { SUBJECTS } from "@/lib/constants";
import { trackEvent, Events } from "@/lib/analytics";

export default function Dashboard() {
  const router = useRouter();
  const [sessions, setSessions]               = useState({});
  const [recentChats, setRecentChats]         = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [hasMounted, setHasMounted]           = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  const chatHistory =
  currentSessionId && sessions[currentSessionId]
    ? sessions[currentSessionId]
    : [];

  const [message, setMessage]               = useState("");
  const [files, setFiles]                   = useState([]);
  const [isDarkMode, setIsDarkMode]         = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [isSidebarOpen, setIsSidebarOpen]   = useState(true);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [mode, setMode]                     = useState("LEARN");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail]               = useState('');
  const [forgotMsg, setForgotMsg]                   = useState(null);
  const [forgotLoading, setForgotLoading]           = useState(false);
  const [showAdmin, setShowAdmin]       = useState(false);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [showStudyPicker, setShowStudyPicker] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery]       = useState("");
  const [isSearchOpen, setIsSearchOpen]     = useState(false);

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds]   = useState({});

  // Pomodoro
  const [showPomodoro, setShowPomodoro]     = useState(false);

  // Session rename
  const [editingChatId, setEditingChatId]   = useState(null);
  const [editingTitle, setEditingTitle]     = useState("");

  // Quiz state
  // Quiz state managed by useQuiz hook — wired after userId resolves
  const [quizType, setQuizType]             = useState(null);
  const [isQuizTypeDropdownOpen, setIsQuizTypeDropdownOpen] = useState(false);
  const [isQuizActive, setIsQuizActive]     = useState(false);
  const [inputError, setInputError] = useState(null);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [isQuestionAnswered, setIsQuestionAnswered] = useState(false);
  const [paperAnswers, setPaperAnswers]     = useState({});
  const [previousPapers, setPreviousPapers] = useState([]);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // ── NEW FEATURE STATE ──────────────────────
  // null until the mount effect confirms a real authenticated session
  const [userId, setUserId] = useState(null);
  const [profileData, setProfileData]       = useState(null);
  const [xpData, setXpData]                 = useState(null);
  const [streakData, setStreakData]          = useState(null);
  const [showProfile, setShowProfile]       = useState(false);
  const [showPlanner, setShowPlanner]       = useState(false);
  const [showWeakness, setShowWeakness]     = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings]           = useState(false);
  const [showProfileMenu, setShowProfileMenu]     = useState(false);
  const [settingsTab, setSettingsTab]             = useState('general');
  const [unreadCount, setUnreadCount]       = useState(0);
  const [weaknessCount, setWeaknessCount]   = useState(0);
  const [lastFeedbackWrong, setLastFeedbackWrong] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab]   = useState('chats');
  const [milestoneToast, setMilestoneToast] = useState(null); // { title, message, xp }
  const [levelUpToast, setLevelUpToast]     = useState(null); // { level, reward }
  const [pwCurrent, setPwCurrent]   = useState('');
  const [pwNew, setPwNew]           = useState('');
  const [pwMsg, setPwMsg]           = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [weeklyProgress, setWeeklyProgress] = useState(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  const [freezeLoading, setFreezeLoading]         = useState(false);

  const chatEndRef         = useRef(null);
  const abortControllerRef = useRef(null);

  // Fetch one session's real messages from Postgres. Never falls back to
  // localStorage for message content — Postgres is the only source of truth.
  const loadSessionHistory = async (sessionId) => {
    if (!sessionId) return;
    try {
      const res = await apiFetch(`${API_URL}/chat/history/${sessionId}`);
      const data = await res.json();
      setSessions(prev => ({ ...prev, [sessionId]: data.history || [] }));
    } catch (e) {
      console.error('[chat/history]', e);
    }
  };

  // Open a chat: switch the active session, fetch its content from the
  // backend if we don't already have it cached in memory for this page load.
  const openSession = async (sessionId, sessionMode) => {
    setCurrentSessionId(sessionId);
    if (sessionMode) setMode(sessionMode);
    if (!sessions[sessionId]) {
      await loadSessionHistory(sessionId);
    }
  };

  // ── Hydration ──────────────────────────────
  useEffect(() => {
    const uid   = localStorage.getItem("scholarly_user_id");
    const token = localStorage.getItem("scholarly_token");

    if (!uid || !token) {
      router.replace("/login");
      return;
    }

    setUserId(uid);

    // UI-only preferences — never chat content
    const savedBookmarks = localStorage.getItem(`scholarly_bookmarks_${uid}`);
    const savedTheme     = localStorage.getItem(`scholarly_theme_${uid}`);
    const lastOpenedId   = localStorage.getItem(`scholarly_last_opened_chat_${uid}`);

    if (savedBookmarks) setBookmarkedIds(JSON.parse(savedBookmarks));

    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }

    // Postgres is the single source of truth for sessions and messages.
    // Fetch the session list, then lazily fetch content only for the one
    // chat we're about to open — not every session on every page load.
    apiFetch(`${API_URL}/chat/sessions`).then(r => r.json()).then(async (d) => {
      const backendSessions = (d.sessions || []).map(s => ({
        id: s.session_id,
        title: s.preview,
        mode: s.mode,
      }));
      setRecentChats(backendSessions);

      const toOpen = backendSessions.find(s => s.id === lastOpenedId) || backendSessions[0];
      if (toOpen) {
        await openSession(toOpen.id, toOpen.mode);
      } else if (lastOpenedId) {
        // Session list call succeeded but didn't (yet) include the chat we
        // were in — e.g. a background save hadn't committed yet. Try to
        // open it directly rather than assuming it doesn't exist.
        await openSession(lastOpenedId);
      } else {
        setCurrentSessionId(Date.now().toString());
      }
    }).catch(async (e) => {
      console.error('[chat/sessions]', e);
      // The session LIST failed to load — likely a transient backend/DB
      // hiccup, not proof the chat is gone. Never discard a known session
      // pointer on a transient error; try to open it directly instead.
      if (lastOpenedId) {
        await openSession(lastOpenedId);
      } else {
        setCurrentSessionId(Date.now().toString());
      }
    });

    setHasMounted(true);

    // Touch streak & load XP/streak/profile on mount
    // Restore cached profile data for offline use
    // Only use cache as fallback — DB fetch always takes priority
    const cachedStreak  = localStorage.getItem(`scholarly_streak_${uid}`);
    const cachedXp      = localStorage.getItem(`scholarly_xp_${uid}`);
    const cachedProfile = localStorage.getItem(`scholarly_profile_${uid}`);
    // Set cached values only as placeholders — will be overwritten by DB fetch
    try { if (cachedStreak)  setStreakData(JSON.parse(cachedStreak)); } catch {}
    // try { if (cachedXp)      setXpData(JSON.parse(cachedXp)); } catch {}
    try { if (cachedProfile) setProfileData(JSON.parse(cachedProfile)); } catch {}

    // Touch streak & load XP/streak/profile on mount — update cache on success
    Promise.all([
      apiFetch(`${API_URL}/streak/${uid}`).then(r => r.json()).then(d => {
        setStreakData(d);
        localStorage.setItem(`scholarly_streak_${uid}`, JSON.stringify(d));
      }).catch(e => console.error('[streak]', e)),
      apiFetch(`${API_URL}/xp/${uid}`).then(r => r.json()).then(d => {
        setXpData(d);
        localStorage.setItem(`scholarly_xp_${uid}`, JSON.stringify(d));
      }).catch(e => console.error('[xp]', e)),
      apiFetch(`${API_URL}/profile/${uid}`).then(r => r.json()).then(d => {
        setProfileData(d);

        if (!d?.onboarding_complete) {
          setShowOnboarding(true);
        }

        localStorage.setItem(`scholarly_profile_${uid}`, JSON.stringify(d));
      if (d?.is_admin) setIsAdmin(true);
      }).catch(e => console.error('[profile]', e)),
      apiFetch(`${API_URL}/notifications/${uid}`).then(r => r.json()).then(d => {
        const unread = (d.notifications || []).filter(n => !n.read).length;
        setUnreadCount(unread);
      }).catch(e => console.error('[notifications]', e)),
      apiFetch(`${API_URL}/weaknesses/${uid}`).then(r => r.json()).then(d => {
        setWeaknessCount((d.weaknesses || []).length);
      }).catch(e => console.error('[weaknesses]', e)),
      apiFetch(`${API_URL}/papers/${uid}`).then(r => r.json()).then(d => {
        setPreviousPapers((d.papers || []).map(p => p.content));
      }).catch(e => console.error('[papers]', e)),
      // Load weekly progress
      apiFetch(`${API_URL}/profile/${uid}/progress`)
        .then(r => r.json())
        .then(d => {
          const p = d.progress || [];
          const totals = p.reduce((acc, day) => ({
            quizzes:    acc.quizzes    + day.quizzes_passed,
            weaknesses: acc.weaknesses + day.weaknesses_cleared,
            xp:         acc.xp        + day.xp_earned,
            minutes:    acc.minutes   + day.study_minutes,
          }), { quizzes: 0, weaknesses: 0, xp: 0, minutes: 0 });
          setWeeklyProgress(totals);
        })
        .catch(() => {}),
      // Check AI availability
      apiFetch(`${API_URL}/health`)
        .then(r => r.json())
        .then(d => setAiUnavailable(d.groq !== "ok"))
        .catch(() => {})
    ]);

    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  // sessions/recentChats are an in-memory cache of what's in Postgres —
  // never persisted to localStorage. Only a pointer to "which chat was
  // last open" is kept, purely so a returning visit can jump back to it.
  useEffect(() => {
    if (hasMounted && currentSessionId) {
      localStorage.setItem(`scholarly_last_opened_chat_${userId}`, currentSessionId);
    }
  }, [currentSessionId, hasMounted]);

  // Persist bookmarks
  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem(`scholarly_bookmarks_${userId}`, JSON.stringify(bookmarkedIds));
    }
  }, [bookmarkedIds, hasMounted]);

  // Persist theme + apply class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (hasMounted) {
      localStorage.setItem(`scholarly_theme_${userId}`, isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode, hasMounted]);

  // ── Helpers ────────────────────────────────
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [chatHistory]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isQuizActive) {
      e.preventDefault();
      if (message.trim() || files.length > 0) handleSend();
    }
  };

  const toggleBookmark = (msgId) => {
    setBookmarkedIds(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const startRename = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const commitRename = (chatId) => {
    if (editingTitle.trim()) {
      setRecentChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editingTitle.trim() } : c));
    }
    setEditingChatId(null);
  };

  const filteredChats = recentChats.filter(chat =>
    (chat.title ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Switch mode: resume last session of that mode, or open a fresh one ──
  const switchMode = async (newMode) => {
    setIsModeMenuOpen(false);
    if (newMode === mode) return; // already in this mode, do nothing
    if (newMode !== "QUIZ") exitQuiz();

    // Find the most recent chat that belongs to newMode
    const existing = recentChats.find(c => c.mode === newMode);
    if (existing) {
      await openSession(existing.id, newMode);
    } else {
      // No prior session for this mode — open a blank one
      setCurrentSessionId(Date.now().toString());
    }
    setMode(newMode);
  };

  // Level reward definitions — cosmetic avatar unlocks at each milestone level
  const LEVEL_REWARDS = {
    2:  { emoji: '🦉', label: 'Night Owl avatar unlocked' },
    3:  { emoji: '🚀', label: 'Rocket avatar unlocked' },
    5:  { emoji: '🧠', label: 'Brain avatar unlocked' },
    7:  { emoji: '⚡', label: 'Lightning avatar unlocked' },
    10: { emoji: '🔬', label: 'Scientist avatar unlocked' },
    15: { emoji: '🎯', label: 'Bullseye avatar unlocked' },
    20: { emoji: '💡', label: 'Genius avatar unlocked' },
    25: { emoji: '🏆', label: 'Champion avatar unlocked' },
    50: { emoji: '🎓', label: 'Graduate avatar unlocked' },
  };

  // Award XP helper — detects level-up and shows celebration toast
  const awardXp = async (action = "message_sent") => {
    const prevLevel = xpData?.level || 1;
    const fd = new FormData(); fd.append('action', action);
    const r = await apiFetch(`${API_URL}/xp/${userId}/add`, { method: 'POST', body: fd });
      if (!r.ok) return;
      const data = await r.json();
      setXpData(data);
      if (data.level && data.level > prevLevel) {
        const reward = LEVEL_REWARDS[data.level] || null;
        setLevelUpToast({ level: data.level, reward });
        setTimeout(() => setLevelUpToast(null), 5000);
      }
  };

  // Refresh notifications count
  const refreshNotifications = () => {
    apiFetch(`${API_URL}/notifications/${userId}`).then(r => r.json()).then(d => {
      const unread = (d.notifications || []).filter(n => !n.read).length;
      setUnreadCount(unread);
    }).catch(e => console.error('[notifications:refresh]', e));
  };

  // ── Quiz type selection ────────────────────
  // Maps UX-facing quiz types to backend quiz_type values — no backend change needed.
  // 'practice' and 'challenge' both use 'single', differing only in difficulty hint
  // sent via the message text; 'custom' uses 'paper' for multi-question generation.
  const selectQuizType = (uxType) => {
    const BACKEND_TYPE = {
      single:    'single',
      practice:  'single',
      challenge: 'single',
      custom:    'paper',
    };
    setQuizType(BACKEND_TYPE[uxType] || uxType);
    setIsQuizTypeDropdownOpen(false);
  };

  // ── Handle option click in quiz ────────────
  const handleOptionSelected = async (selectedLetter) => {
    setIsQuestionAnswered(true);
    const currentId = currentSessionId;
    const userMsg = { role: "user", content: `My answer: ${selectedLetter})`, id: Date.now() };
    setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), userMsg] }));
    setTimeout(() => submitQuizAnswer(selectedLetter), 500);
  };

  // ── Submit quiz answer ─────────────────────
  const submitQuizAnswer = async (answer) => {
    const currentId = currentSessionId;
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("message",         answer);
      formData.append("session_id",      currentId);
      formData.append("mode",            mode);
      formData.append("quiz_type",       quizType);
      formData.append("question_number", questionNumber + 1);
      formData.append("is_starting",     "false");
      formData.append("user_id",         userId);
      formData.append("last_was_wrong",  lastFeedbackWrong ? "true" : "false");
      if (currentQuizQuestion) formData.append("last_question", currentQuizQuestion);

      const response = await apiFetch(`${API_URL}/quiz`, { method: "POST", body: formData });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Quiz error ${response.status}: ${errText}`);
      }

      const data     = await response.json();
      const feedbackLower = (data.feedback || '').toLowerCase();
      const wasWrong = feedbackLower.includes('incorrect') || feedbackLower.includes('wrong') || feedbackLower.includes('not correct');
      setLastFeedbackWrong(wasWrong);

      if (data.feedback) {
        const feedbackMsg = {
          role: "assistant", content: `**Feedback:** ${data.feedback}`,
          id: Date.now() + 1, isFeedback: true,
        };
        setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), feedbackMsg] }));
      }

      const newQuestion = {
        role: "assistant", content: data.new_question,
        id: Date.now() + 2, isQuestion: true,
      };
      setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), newQuestion] }));

      setCurrentQuizQuestion(data.new_question);
      setQuestionNumber(data.question_number);
      setIsQuestionAnswered(false);

      // Award XP per quiz question answered
      await awardXp(wasWrong ? "message_sent" : "quiz_correct");
      trackEvent(Events.QUIZ_COMPLETED, { correct: !wasWrong });

    } catch (error) {
      console.error("Quiz error:", error);
      setSessions(prev => ({
        ...prev,
        [currentId]: [
          ...(prev[currentId] || []),
          { role: "assistant", content: "⚠️ Error loading next question. Please try again.", id: "error" },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Show answers for question paper ────────
  const handleShowAnswers = async (msgId, paperContent) => {
    setIsLoadingAnswers(prev => ({ ...prev, [msgId]: true }));
    try {
      const fd = new FormData();
      // NEW
      fd.append('session_id', currentSessionId);
      fd.append('paper_content', paperContent);
      const res = await apiFetch(`${API_URL}/quiz/answers`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Answers error ${res.status}`);
      const data = await res.json();
      setPaperAnswers(prev => ({ ...prev, [msgId]: data.answers }));
    } catch (err) {
      console.error('Error fetching answers:', err);
    } finally {
      setIsLoadingAnswers(prev => ({ ...prev, [msgId]: false }));
    }
  };

  // ── Regular chat send ──────────────────────
  const handleSend = async (overrideMessage = null) => {
    setInputError(null);
    const activeMessage = overrideMessage ?? message;
    if (!activeMessage.trim() && files.length === 0) return;

    // Input validation
    const MAX_MESSAGE_LENGTH = 5000;
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_FILE_TYPES = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg'];

    // Validate message length
    if (message.length > MAX_MESSAGE_LENGTH) {
      setInputError(`Message exceeds ${MAX_MESSAGE_LENGTH} character limit`); return;
    }

    // Validate file count
    if (files.length > MAX_FILES) {
      setInputError(`Maximum ${MAX_FILES} files allowed`); return;
    }

    // Validate file sizes and types
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setInputError(`File "${file.name}" exceeds 50MB limit`); return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setInputError(`File type not allowed. Allowed: PDF, TXT, PNG, JPEG`); return;
      }
    }

    const currentId = currentSessionId;
    const userMsg   = { role: "user", content: activeMessage, id: Date.now() };

    // Touch streak on real study activity — send local date so server
    // respects the user's timezone, not UTC server time

    if (!sessions[currentId] || sessions[currentId].length === 0) {
      const title = message.substring(0, 25) + (message.length > 25 ? "..." : "");
      setRecentChats(prev => [{ id: currentId, title, mode }, ...prev]);
    }

    setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), userMsg] }));

    const messageToSend = activeMessage;
    if (!overrideMessage) setMessage("");
    setIsLoading(true);

    try {
      if (mode === "QUIZ" && quizType === "single" && !isQuizActive) {
        setIsQuizActive(true);
        setQuestionNumber(1);
        setIsQuestionAnswered(false);
        setPaperAnswers(null);

        const formData = new FormData();
        formData.append("message",         messageToSend);
        formData.append("session_id",      currentId);
        formData.append("mode",            mode);
        formData.append("quiz_type",       "single");
        formData.append("question_number", 1);
        formData.append("is_starting",     "true");
        formData.append("user_id",         userId);

        const response = await apiFetch(`${API_URL}/quiz`, { method: "POST", body: formData });
        const data     = await response.json();
        if (!response.ok) {
          setIsQuizActive(false);
          setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), { role: "assistant", content: data.detail, id: Date.now() + 1 }] }));
        } else {
          const botMsg = { role: "assistant", content: data.new_question, id: Date.now() + 1, isQuestion: true };
          setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), botMsg] }));
          setCurrentQuizQuestion(data.new_question);
        }

      } else if (mode === "QUIZ" && quizType === "paper") {
        setIsQuizActive(true);

        const formData = new FormData();
        formData.append("message",         messageToSend);
        formData.append("session_id",      currentId);
        formData.append("mode",            mode);
        formData.append("quiz_type",       "paper");
        formData.append("question_number", 1);
        formData.append("is_starting",     "true");
        formData.append("previous_papers", previousPapers.join("\n\n---PREVIOUS PAPER---\n\n"));
        formData.append("user_id",         userId);

        const response = await apiFetch(`${API_URL}/quiz`, { method: "POST", body: formData });
        const data     = await response.json();
        if (!response.ok) {
          setIsQuizActive(false);
          setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), { role: "assistant", content: data.detail, id: Date.now() + 1 }] }));
        } else {
          const botMsg = { role: "assistant", content: data.new_question, id: Date.now() + 1, isPaper: true };
          setSessions(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), botMsg] }));
          setPreviousPapers(prev => [...prev, data.new_question]);
        }

      } else if (mode !== "QUIZ") {
        // Abort any previous in-flight request
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const formData = new FormData();
        formData.append("message",    messageToSend);
        formData.append("session_id", currentId);
        formData.append("mode",       mode);
        // Trim to last 20 — prevents context window overflow on long sessions
        formData.append("history",    JSON.stringify((sessions[currentId] || []).slice(-20)));
        files.forEach(file => formData.append("files", file));

        clearTimeout(timeoutId);
        const decoder = new TextDecoder();
        let botResponse = "";
        let continueCount = 0;
        const MAX_CONTINUES = 5;

        setSessions(prev => ({
          ...prev,
          [currentId]: [...(prev[currentId] || []), { role: "assistant", content: "", id: "streaming" }],
        }));

        const fetchStream = async (fd, retryCount = 0) => {
          const MAX_RETRIES = 2;
          const STREAM_TIMEOUT_MS = 15000; // 15s of silence before retry

          let res;
          try {
            res = await apiFetch(`${API_URL}/chat`, {
              method: "POST",
              body: fd,
              signal: controller.signal,
            });
          } catch (err) {
            if (err.name === "AbortError") throw err;
            if (retryCount < MAX_RETRIES) {
              console.warn(`[stream] fetch failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
              await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
              return fetchStream(fd, retryCount + 1);
            }
            throw err;
          }

          if (!res.ok || !res.body) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Server error ${res.status}: ${errText}`);
          }

          const reader = res.body.getReader();
          let silenceTimer;

          const resetSilenceTimer = () => {
            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(async () => {
              reader.cancel();
              if (retryCount < MAX_RETRIES && botResponse.length > 0) {
                console.warn("[stream] silence timeout — reconnecting...");
                setSessions(prev => {
                  const chat = [...(prev[currentId] || [])];
                  chat[chat.length - 1] = { role: "assistant", content: botResponse + "\n\n_Reconnecting..._", id: "streaming" };
                  return { ...prev, [currentId]: chat };
                });
                const contForm = new FormData();
                contForm.append("message", "continue from exactly where you left off, no preamble");
                contForm.append("session_id", currentId);
                contForm.append("mode", mode);
                contForm.append("history", JSON.stringify([
                  ...(sessions[currentId] || []).slice(-20),
                  { role: "assistant", content: botResponse },
                ]));
                await fetchStream(contForm, retryCount + 1);
              }
            }, STREAM_TIMEOUT_MS);
          };

          try {
            resetSilenceTimer();
            while (true) {
              const { done, value } = await reader.read();
              if (done) { clearTimeout(silenceTimer); break; }
              resetSilenceTimer();
              botResponse += decoder.decode(value);
              setSessions(prev => {
                const chat = [...(prev[currentId] || [])];
                chat[chat.length - 1] = { role: "assistant", content: botResponse, id: "streaming" };
                return { ...prev, [currentId]: chat };
              });
            }
          } finally {
            clearTimeout(silenceTimer);
          }
        };

        await fetchStream(formData);

        while (continueCount < MAX_CONTINUES) {
          const trimmed = botResponse.trimEnd();
          const lastChar = trimmed[trimmed.length - 1];
          const looksIncomplete = ![ '.', '!', '?', '`', '―', '"', '\'' ].includes(lastChar)
            && /(\d+[\).]|Q\d+|##|###|\*\*[^*]+$|[A-Za-z,])$/.test(trimmed);
          if (!looksIncomplete) break;
          continueCount++;
          const contForm = new FormData();
          contForm.append("message", "continue from exactly where you left off, no preamble");
          contForm.append("session_id", currentId);
          contForm.append("mode", mode);
          contForm.append("history", JSON.stringify([
            ...(sessions[currentId] || []).slice(-20),
            { role: "assistant", content: botResponse },
          ]));
          await fetchStream(contForm);
        }

        abortControllerRef.current = null;

        // Award XP for chat messages
        await awardXp("message_sent");
        trackEvent(Events.CHAT_MESSAGE, { mode });
      }
    } catch (error) {
      console.error("Send error:", error);
      setSessions(prev => ({
        ...prev,
        [currentId]: [
          ...(prev[currentId] || []),
          { role: "assistant", content: "⚠️ Something went wrong. Please try again.", id: "error" },
        ],
      }));
    } finally {
      setIsLoading(false);
      setFiles([]);
    }
  };

  // ── Exit quiz ──────────────────────────────
  const exitQuiz = async () => {
    try {
      const formData = new FormData();
      formData.append("session_id", currentId);
      const response = await apiFetch(`${API_URL}/quiz/reset`, { method: "POST", body: formData });
    } catch (error) {
      console.error("Error resetting quiz:", error);
    }
    setIsQuizActive(false);
    setQuizType(null);
    setIsQuizTypeDropdownOpen(false);
    setQuestionNumber(1);
    setCurrentQuizQuestion(null);
    setIsQuestionAnswered(false);
    setPaperAnswers(null);
  };

  if (!hasMounted) return null;

  const MODES = ["LEARN", "QUIZ", "SUMMARY", "ANALYSIS", "CODE"];
  const modeColors = {
    LEARN: "bg-zinc-100 dark:bg-zinc-800",
    QUIZ: "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100",
    SUMMARY: "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100",
    ANALYSIS: "bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100",
    CODE: "bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100",
  };

  // ── Render ─────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors duration-300 antialiased">
      {/* Themed scrollbars */}
      <style>{`
        :root { --sb-thumb: #d4d4d8; --sb-track: #f4f4f5; }
        .dark { --sb-thumb: #27272a; --sb-track: #09090b; }
        * { scrollbar-width: thin; scrollbar-color: var(--sb-thumb) var(--sb-track); }
        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-track { background: var(--sb-track); border-radius: 99px; }
        *::-webkit-scrollbar-thumb { background: var(--sb-thumb); border-radius: 99px; }
        *::-webkit-scrollbar-thumb:hover { background: ${isDarkMode ? '#71717a' : '#a1a1aa'}; }
      `}</style>

      <div className="flex h-screen overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={`${isSidebarOpen ? 'w-65' : 'w-0'} overflow-hidden transition-all duration-300 flex flex-col shrink-0 bg-zinc-50 dark:bg-[#0a0a0a]`}>
          <div className="flex flex-col h-full min-w-65 bg-zinc-50 dark:bg-[#0a0a0a]">

            {/* Top: logo + collapse */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-7 h-7 bg-linear-to-br from-violet-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
                  <GraduationCap className="text-white" size={14} />
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">Clarix</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.07] transition">
                <Menu size={16} />
              </button>
            </div>

            {/* Action rows */}
            <div className="px-3 pt-1 pb-2 space-y-0.5">
              <button
                onClick={() => { exitQuiz(); setCurrentSessionId(Date.now().toString()); setSearchQuery(''); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.07] transition-all"
              >
                <Pencil size={15} className="text-zinc-400 dark:text-zinc-500" /> New chat
              </button>
              <div className="relative">
                <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.07] transition-all">
                  <Search size={15} className="text-zinc-400 dark:text-zinc-500" />
                  <input
                    type="text" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search chats"
                    className="bg-transparent text-sm outline-none w-full text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={12} /></button>}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px mx-3 mb-2 bg-white/8" />

            {/* Recents label */}
            {filteredChats.length > 0 && (
              <p className="px-4 pb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Recents</p>
            )}

            {/* Chat list */}
            <nav className="flex-1 overflow-y-auto px-3 pb-2">
              {filteredChats.length === 0 && searchQuery && (
                <p className="text-xs text-zinc-600 text-center pt-4">No chats found</p>
              )}
              {filteredChats.map(chat => (
                <div key={`recent-${chat.id}`} className="group relative mb-0.5">
                  {editingChatId === chat.id ? (
                    <div className="flex items-center gap-1 p-1">
                      <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(chat.id); if (e.key === 'Escape') setEditingChatId(null); }}
                        className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 outline-none text-zinc-900 dark:text-white" />
                      <button onClick={() => commitRename(chat.id)} className="p-1 text-green-500"><Check size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { exitQuiz(); openSession(chat.id, chat.mode); }}
                      className={`w-full text-left px-3 py-2 rounded-xl transition-all text-sm truncate ${
                        currentSessionId === chat.id
                          ? 'bg-zinc-200 dark:bg-white/9 text-zinc-900 dark:text-white font-medium'
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/6 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >{chat.title}</button>
                  )}
                  {editingChatId !== chat.id && (
                    <button onClick={e => startRename(chat, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              ))}
            </nav>

            {/* ── Profile row at bottom — like ChatGPT ── */}
            <div className="relative px-3 pb-3 pt-1">
              <div className="h-px mb-2 bg-white/8" />
              <button
                onClick={() => setShowProfileMenu(p => !p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 transition-all group"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black text-white shrink-0 shadow-md">
                  {profileData?.avatar && profileData.avatar.length <= 2 ? profileData.avatar : profileData?.name ? profileData.name[0].toUpperCase() : 'S'}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white truncate transition">{profileData?.name || 'Scholar'}</p>
                  {/* XP pill */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1 w-16 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-linear-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.round(((xpData?.total || 0) % 500) / 500 * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-600">Lv {xpData?.level || 1}</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition shrink-0" />
              </button>

              {/* Profile popup menu — opens upward */}
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div 
                    className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl z-50 shadow-2xl flex flex-col bg-zinc-800 dark:bg-[#1c1c1e] border border-zinc-700 dark:border-white/10"
                    style={{ height: '380px' }}>
                  <div className="flex-1 overflow-y-auto overflow-x-hidden">

                    {/* Profile card row */}
                    <button
                      onClick={() => { setShowProfileMenu(false); setShowProfile(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-100 dark:hover:bg-white/6 transition-all"
                    >
                      <div className="w-9 h-9 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base font-black text-white shrink-0">
                        {profileData?.avatar && profileData.avatar.length <= 2 ? profileData.avatar : profileData?.name ? profileData.name[0].toUpperCase() : 'S'}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{profileData?.name || 'Scholar'}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{profileData?.email || 'View profile'}</p>
                      </div>
                      <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                    </button>

                    <div className="h-px mx-3 bg-zinc-700 dark:bg-white/[0.07]" />

                    {/* Tool rows */}
                    {[
                      { icon: AlertTriangle, label: 'Weakness Tracker', sub: weaknessCount > 0 ? `${weaknessCount} to review` : 'All clear', badge: weaknessCount || 0, action: () => { setShowProfileMenu(false); setShowWeakness(true); } },
                      { icon: Calendar,      label: 'Daily Planner',    sub: 'AI study schedule',   badge: 0, action: () => { setShowProfileMenu(false); setShowPlanner(true); } },
                      { icon: Coffee,        label: 'Pomodoro Timer',   sub: '25-min focus sessions', badge: 0, action: () => { setShowPomodoro(p => !p); setShowProfileMenu(false); } },
                      { icon: BookOpen,      label: 'Knowledge Base',   sub: 'Shared documents',    badge: 0, action: () => { setShowProfileMenu(false); setShowKnowledge(true); } },
                    ].map(({ icon: Icon, label, sub, badge, action }) => (
                      <button key={label} onClick={action}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all">
                        <Icon size={16} className="text-zinc-500 shrink-0" />
                        <div className="flex-1 text-left">
                          <p className="text-sm text-zinc-800 dark:text-zinc-200">{label}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</p>
                        </div>
                        {badge > 0 && <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">{badge}</span>}
                      </button>
                    ))}

                    <div className="h-px mx-3 bg-zinc-700 dark:bg-white/[0.07]" />

                    {/* Settings + Appearance */}
                    {[
                      { icon: Settings, label: 'Settings', action: () => { setShowProfileMenu(false); setShowSettings(true); setSettingsTab('general'); } },
                      { icon: isDarkMode ? Sun : Moon, label: isDarkMode ? 'Light mode' : 'Dark mode', action: () => { setIsDarkMode(p => !p); setShowProfileMenu(false); } },
                    ].map(({ icon: Icon, label, action }) => (
                      <button key={label} onClick={action}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all">
                        <Icon size={16} className="text-zinc-500 shrink-0" />
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">{label}</p>
                      </button>
                    ))}

                    {isAdmin && (
                        <button onClick={() => { setShowProfileMenu(false); setShowAdmin(true); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all">
                          <Shield size={16} className="text-violet-400 shrink-0" />
                          <p className="text-sm text-violet-400 font-semibold">Admin Panel</p>
                        </button>
                      )}

                    <div className="h-px mx-3 bg-zinc-100 dark:bg-white/[0.07]" />

                    {/* Log out */}
                    <button
                      onClick={() => {
                        localStorage.removeItem('scholarly_token');
                        localStorage.removeItem('scholarly_user_id');
                        localStorage.removeItem('scholarly_email');
                        localStorage.removeItem('scholarly_name');
                        window.location.href = '/login';
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
                    >
                      <LogOut size={16} className="text-red-400 shrink-0" />
                      <p className="text-sm text-red-500 dark:text-red-400">Log out</p>
                    </button>
                  </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>


        {/* ── Main ── */}
        <div className="flex-1 flex flex-col relative overflow-hidden">

          {/* Header — Image 1 style: name left, ··· right */}
          <header className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-zinc-200 dark:border-white/6 bg-white dark:bg-black/95 backdrop-blur-xl shadow-sm dark:shadow-none">

            {/* Left: hamburger (when sidebar closed) + app name */}
            <div className="flex items-center gap-2">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition">
                  <Menu size={17} />
                </button>
              )}
              {/* Mode badge — subtle, centreish */}
              <div className="flex items-center gap-2">
                {isQuizActive && mode === 'QUIZ' && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                    {quizType === 'single' ? 'Single MCQ' : 'Question Paper'}
                  </span>
                )}
                {mode === 'CODE' && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                    <Code2 size={11} /> Code Mode
                  </span>
                )}
              </div>
            </div>

            {/* Centre — app name (matches ChatGPT 'ChatGPT ˅') */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">Clarix</span>
              <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-600" />
            </div>

            {/* Right: notifications + mode selector + ··· */}
            <div className="flex items-center gap-1">
              {/* Notifications */}
              <div className="relative">
                <button onClick={() => { setShowNotifications(p => !p); if (!showNotifications) refreshNotifications(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition relative">
                  <Bell size={17} />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {showNotifications && <NotificationsPanel userId={userId} unreadCount={unreadCount} onClose={() => setShowNotifications(false)} onRead={() => { setUnreadCount(0); setShowNotifications(false); }} />}
              </div>

              {/* Mode selector — compact icon */}
              <div className="relative">
                <button onClick={() => setIsModeMenuOpen(p => !p)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition" title={`Mode: ${mode}`}>
                  {mode === 'CODE' ? <Code2 size={16} /> : mode === 'QUIZ' ? <Flame size={16} /> : mode === 'SUMMARY' ? <LineChart size={16} /> : mode === 'ANALYSIS' ? <TrendingUp size={16} /> : <BookOpen size={16} />}
                </button>
                {isModeMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-44 rounded-2xl overflow-hidden shadow-2xl z-50 bg-zinc-800 dark:bg-[#1c1c1e] border border-zinc-700 dark:border-white/10">
                    {MODES.map(m => (
                      <button key={`mode-${m}`} onClick={() => switchMode(m)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                          mode === m ? 'text-zinc-900 dark:text-white font-semibold bg-zinc-100 dark:bg-white/8' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}>
                        {m === 'CODE' && <Code2 size={13} className="text-emerald-400" />}
                        {m === 'LEARN' && <BookOpen size={13} className="text-blue-400" />}
                        {m === 'QUIZ' && <Flame size={13} className="text-purple-400" />}
                        {m === 'SUMMARY' && <LineChart size={13} className="text-cyan-400" />}
                        {m === 'ANALYSIS' && <TrendingUp size={13} className="text-indigo-400" />}
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quiz type (when in QUIZ mode) */}
              {mode === 'QUIZ' && !isQuizActive && (
                <div className="relative">
                  <button onClick={() => setIsQuizTypeDropdownOpen(p => !p)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition">
                    {quizType ? (quizType === 'single' ? 'Single Q' : 'Paper') : 'Quiz type'} <ChevronDown size={12} />
                  </button>
                  {isQuizTypeDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-52 rounded-2xl overflow-hidden shadow-2xl z-50 bg-zinc-800 dark:bg-[#1c1c1e] border border-zinc-700 dark:border-white/10">
                      {[
                        { type: 'single',    label: 'Single MCQ',     desc: 'One question at a time' },
                        { type: 'practice',  label: 'Practice Quiz',  desc: 'Relaxed pace, hints allowed' },
                        { type: 'challenge', label: 'Challenge Quiz', desc: 'Harder, timed questions' },
                        { type: 'custom',    label: 'Custom Quiz',    desc: 'Full question paper' },
                      ].map(({ type, label, desc }) => (
                        <button key={type} onClick={() => selectQuizType(type)}
                          className="w-full text-left px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-all">
                          <p className="font-semibold">{label}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isQuizActive && (
                <button onClick={exitQuiz} className="h-8 px-3 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-white/[0.07] transition">Exit Quiz</button>
              )}

              {/* Settings shortcut — only path to Settings when the sidebar is collapsed */}
              <button
                onClick={() => { setShowSettings(true); setSettingsTab('general'); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition"
                title="Settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </header>


          {/* Messages */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">

            <XPBar
              xpData={xpData}
              streakData={streakData}
            />

            {aiUnavailable && (
              <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                <span className="text-xs font-semibold text-red-400">⚠️ AI service is temporarily unavailable. Responses may fail.</span>
              </div>
            )}

            {weeklyProgress && (weeklyProgress.quizzes > 0 || weeklyProgress.xp > 0) && (
              <div className="mx-4 mt-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-violet-400">This week:</span>

                {weeklyProgress.quizzes > 0 && (
                  <span className="text-xs text-zinc-400">
                    🧠 <strong className="text-zinc-200">{weeklyProgress.quizzes}</strong>
                    {" "}quiz{weeklyProgress.quizzes > 1 ? "zes" : ""}
                  </span>
                )}

                {weeklyProgress.weaknesses > 0 && (
                  <span className="text-xs text-zinc-400">
                    📉 <strong className="text-zinc-200">{weeklyProgress.weaknesses}</strong>
                    {" "}weakness{weeklyProgress.weaknesses > 1 ? "es" : ""} cleared
                  </span>
                )}

                {weeklyProgress.xp > 0 && (
                  <span className="text-xs text-zinc-400">
                    ⚡ <strong className="text-zinc-200">{weeklyProgress.xp}</strong> XP earned
                  </span>
                )}

                {weeklyProgress.minutes > 0 && (
                  <span className="text-xs text-zinc-400">
                    ⏱ <strong className="text-zinc-200">{weeklyProgress.minutes}</strong> min studied
                  </span>
                )}
              </div>
            )}

            {chatHistory.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 pt-16">
                {/* Personalized Greeting */}
                <div className="text-center mb-12">
                  <h1 className="text-3xl md:text-4xl font-bold mb-6 text-zinc-800 dark:text-zinc-100 tracking-tight">
                    {(() => {
                      const hour = new Date().getHours();
                      const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
                      return `${greeting}, ${profileData?.name || 'Scholar'}`;
                    })()}
                  </h1>
                </div>

                {/* Primary CTA: Start Study Session */}
                <div className="w-full max-w-md mb-12 relative">
                  <button
                    onClick={() => setShowStudyPicker(p => !p)}
                    className="w-full flex items-center justify-between px-8 py-5 rounded-2xl border-2 border-green-400 dark:border-green-500 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900 dark:hover:to-emerald-900 transition-all hover:shadow-lg font-semibold text-green-900 dark:text-green-100"
                  >
                    <div className="flex items-center gap-3">
                      <Zap size={24} className="text-green-600 dark:text-green-400" />
                      <span>Start Study Session</span>
                    </div>
                    <ChevronRight size={20} className={`text-green-600 dark:text-green-400 transition-transform ${showStudyPicker ? 'rotate-90' : ''}`} />
                  </button>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-2">Choose how you want to study</p>

                  {showStudyPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStudyPicker(false)} />
                      <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-50 bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10">
                        {[
                          { icon: BookOpen,      label: 'Learn a Topic',       desc: 'Tutor-style explanations',        color: 'text-blue-500',   action: () => { setMode('LEARN'); setShowStudyPicker(false); } },
                          { icon: Flame,         label: 'Quick Quiz',          desc: 'Single MCQ, one at a time',       color: 'text-green-500',  action: () => { setMode('QUIZ'); setQuizType('single'); setIsQuizActive(true); setMessage(''); setFiles([]); setShowStudyPicker(false); } },
                          { icon: AlertTriangle, label: 'Revise Weak Topics', desc: weaknessCount > 0 ? `${weaknessCount} topics to review` : 'No weak topics yet', color: 'text-orange-500', action: () => { setShowStudyPicker(false); setShowWeakness(true); } },
                          { icon: Bot,           label: 'Ask Clarix',         desc: 'Open-ended Q&A',                  color: 'text-violet-500', action: () => { setMode('LEARN'); setShowStudyPicker(false); } },
                        ].map(({ icon: Icon, label, desc, color, action }) => (
                          <button key={label} onClick={action}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all text-left">
                            <Icon size={18} className={`${color} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                                


                {/* Suggested Prompts */}
                <div className="w-full max-w-3xl mt-8">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-4 text-center">✨ Try These</p>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                    {[
                      { text: "Explain quantum entanglement", icon: "⚛️" },
                      { text: "Quiz me on cell biology", icon: "🧬" },
                      { text: "Solve this calculus problem", icon: "∑" },
                      { text: "Help me write an essay", icon: "✍️" }
                    ].map(({ text, icon }) => (
                      <button
                        key={text}
                        onClick={() => setMessage(text)}
                        className="group relative flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-2xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-white/2 hover:bg-zinc-50 dark:hover:bg-white/5 hover:border-violet-300 dark:hover:border-violet-500/40 hover:shadow-md hover:shadow-violet-100 dark:hover:shadow-violet-900/10 transition-all duration-200 text-center"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{icon}</span>
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 leading-snug group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">{text}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {chatHistory.map((chat, idx) => (
              <div
                key={`msg-${currentSessionId}-${idx}`}
                className={`flex gap-4 group ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${chat.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`p-1.5 rounded-lg h-fit shrink-0 ${chat.role === 'user' ? 'bg-violet-500/20 text-violet-400' : mode === 'CODE' ? 'bg-emerald-600/90 text-white' : 'bg-zinc-900 dark:bg-white/90 text-white dark:text-zinc-900'}`}>
                    {chat.role === 'user' ? <User size={16} /> : mode === 'CODE' ? <Code2 size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${chat.role === 'user' ? 'bg-violet-600 dark:bg-violet-600 text-white rounded-br-sm shadow-md shadow-violet-900/20' : mode === 'CODE' && chat.role === 'assistant' ? 'border border-emerald-900/40 bg-[#0d1a12] text-zinc-100 rounded-bl-sm' : 'bg-white dark:bg-white/4 border border-zinc-200 dark:border-white/[0.07] rounded-bl-sm shadow-sm text-zinc-800 dark:text-zinc-100'}`}>
                    {chat.isFeedback ? (
                      <FeedbackCard 
                        feedback={chat.content.replace("**Feedback:** ", "")} 
                        score={chat.score}
                        total={chat.total}
                        isQuizComplete={chat.isQuizComplete}
                        ReactMarkdown={ReactMarkdown}
                        remarkMath={remarkMath}
                        rehypeKatex={rehypeKatex}
                      />
                    ) : chat.role === 'assistant' && mode === 'QUIZ' && chat.isQuestion ? (
                      <QuizCard
                        content={chat.content}
                        onOptionSelected={handleOptionSelected}
                        isAnswered={isQuestionAnswered}
                        quizType={quizType}
                      />
                    ) : chat.role === 'assistant' && mode === 'QUIZ' && chat.isPaper ? (
                      <QuestionPaperView
                        paper={chat.content}
                        onShowAnswers={() => handleShowAnswers(chat.id, chat.content)}
                        isLoadingAnswers={isLoadingAnswers[chat.id] || false}
                        answers={paperAnswers[chat.id] || null}
                      />
                    ) : chat.isAnswerKey ? (
                      <div className="text-xs text-green-900 dark:text-green-100">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{chat.content}</ReactMarkdown>
                      </div>
                    ) : chat.role === 'assistant' && mode === 'CODE' ? (
                      <ReactMarkdown components={codeMdComponents} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{chat.content}</ReactMarkdown>
                    ) : (
                      <ReactMarkdown components={mdComponents} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{chat.content}</ReactMarkdown>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="self-start mt-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Bookmark */}
                    <button
                      onClick={() => toggleBookmark(chat.id)}
                      title={bookmarkedIds[chat.id] ? "Remove bookmark" : "Bookmark"}
                      className={`p-1 rounded-lg ${bookmarkedIds[chat.id] ? 'text-amber-500 opacity-100' : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400'}`}
                    >
                      {bookmarkedIds[chat.id] ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                    </button>

                    {/* Copy */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(chat.content);
                        setCopiedId(chat.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      title="Copy"
                      className="p-1 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-violet-400 transition-colors"
                    >
                      {copiedId === chat.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                    </button>

                    {/* Retry — assistant messages only */}
                    {chat.role === 'assistant' && !chat.isFeedback && !chat.isQuestion && !chat.isPaper && (
                      <button
                        onClick={() => {
                          const history = sessions[currentSessionId] || [];
                          const userMsgBefore = [...history].slice(0, history.indexOf(chat)).reverse().find(m => m.role === 'user');
                          if (userMsgBefore) {
                            setMessage(userMsgBefore.content);
                            setTimeout(() => handleSend(), 0);
                          }
                        }}
                        title="Retry"
                        className="p-1 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-violet-400 transition-colors"
                      >
                        <RotateCcw size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <div className={`p-1 rounded-lg h-fit ${mode === 'CODE' ? 'bg-emerald-600 text-white' : 'bg-black dark:bg-white text-white dark:text-black'}`}>
                    {mode === 'CODE' ? <Code2 size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="px-4 py-3 rounded-2xl text-sm bg-white dark:bg-white/4 border border-zinc-200 dark:border-white/[0.07] text-zinc-500 dark:text-zinc-500 flex items-center gap-2 rounded-bl-sm shadow-sm">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                    </span>
                    {mode === 'CODE' ? 'Writing code…' : 'Thinking…'}
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </main>

          {/* Input */}
          <footer className="px-4 md:px-6 py-3 md:py-4 bg-slate-100 dark:bg-[#09090b]/90 backdrop-blur-xl border-t border-zinc-200 dark:border-white/6">
            <div className="max-w-3xl mx-auto relative">
              {files.map((f, i) => (
                <div key={`file-${f.name}-${i}`} className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-xs mr-2 mb-2">
                  <Paperclip size={14} />
                  <span>{f.name}</span>
                  <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}><X size={14} /></button>
                </div>
              ))}

              {inputError && (
                <div className="text-xs text-red-400 mb-2 px-1">{inputError}</div>
              )}
              {(!isQuizActive || quizType === "paper") ? (
                <div className={`flex items-end gap-2 p-3 rounded-2xl border transition-all duration-200 shadow-sm focus-within:shadow-lg ${mode === 'CODE' ? 'bg-[#0d1a12] border-emerald-800/60 focus-within:border-emerald-600/60' : 'bg-white dark:bg-white/3 border-zinc-300 dark:border-white/8 focus-within:border-violet-500 dark:focus-within:border-violet-500/40 focus-within:shadow-lg focus-within:shadow-violet-200 dark:focus-within:shadow-violet-900/10'}`}>
                  <label className="p-2 cursor-pointer">
                    <Paperclip size={20} className={mode === 'CODE' ? 'text-zinc-400' : ''} />
                    <input type="file" multiple className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 4000))}
                    onKeyDown={handleKeyDown}
                    maxLength={4000}
                    placeholder={
                      mode === 'CODE'
                        ? "Ask a coding question or describe what to build…"
                        : quizType === "paper"
                          ? "e.g., 10 questions on photosynthesis"
                          : "Ask Clarix…"
                    }
                    className={`flex-1 bg-transparent border-none outline-none p-2 resize-none text-sm leading-relaxed ${mode === 'CODE' ? 'text-zinc-100 placeholder-zinc-500' : 'text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500'}`}
                  />
                  {message.length > 3500 && (
                    <span className={`text-[10px] self-end mb-1 shrink-0 ${message.length >= 4000 ? 'text-red-400' : 'text-zinc-500'}`}>
                      {message.length}/4000
                    </span>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (mode === "QUIZ" && !quizType)}
                    className={`p-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-md ${mode === 'CODE' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-900/30'}`}
                  >
                    <Send size={20} />
                  </button>
                </div>
              ) : (
                <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-2">
                  Click an option above to answer the question
                </div>
              )}
            </div>
          </footer>

          {/* Pomodoro Timer floating widget */}

          {/* Level-Up Toast */}
          {levelUpToast && (
            <div className="fixed bottom-8 right-6 z-50">
              <div className="bg-linear-to-br from-violet-600 to-indigo-700 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-70 border border-violet-400/30 animate-slide-up">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-2xl">⬆️</span>
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm tracking-wide">LEVEL {levelUpToast.level}!</p>
                  <p className="text-xs text-violet-200 mt-0.5">You levelled up — keep going!</p>
                  {levelUpToast.reward && (
                    <div className="mt-2 flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1">
                      <span className="text-lg">{levelUpToast.reward.emoji}</span>
                      <p className="text-[10px] font-bold text-violet-100">{levelUpToast.reward.label}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setLevelUpToast(null)}
                  className="text-white/50 hover:text-white text-lg leading-none shrink-0"
                >×</button>
              </div>
            </div>
          )}

          {/* Milestone Toast */}
          {milestoneToast && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce-once">
              <div className="bg-linear-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-75">
                <span className="text-3xl">{milestoneToast.emoji}</span>
                <div>
                  <p className="font-black text-sm">{milestoneToast.title}</p>
                  <p className="text-xs opacity-90">{milestoneToast.message}</p>
                  <p className="text-xs font-bold mt-0.5">+{milestoneToast.xp} bonus XP 🎁</p>
                </div>
                <button
                  onClick={() => setMilestoneToast(null)}
                  className="ml-auto text-white/70 hover:text-white text-lg leading-none"
                >×</button>
              </div>
            </div>
          )}

          {showPomodoro && <PomodoroTimer onClose={() => setShowPomodoro(false)} />}
        </div>
      </div>

      {/* ── Modals ── */}
      {showProfile && (
        <ProfilePanel
          userId={userId}
          profileData={profileData}
          onProfileUpdate={(d) => {
            setProfileData(d);
            localStorage.setItem(`scholarly_profile_${userId}`, JSON.stringify(d));
            // Keep convenience keys in sync so sidebar name/avatar
            // update immediately and survive hard refresh
            if (d.name) localStorage.setItem('scholarly_name', d.name);
          }}
          xpData={xpData}
          streakData={streakData}
          onClose={() => setShowProfile(false)}
          onLogout={() => {
            localStorage.removeItem('scholarly_token');
            localStorage.removeItem('scholarly_user_id');
            localStorage.removeItem('scholarly_email');
            localStorage.removeItem('scholarly_name');
            window.location.href = '/login';
          }}
        />
      )}

      {showPlanner && (
        <PlannerPanel
          userId={userId}
          onClose={() => setShowPlanner(false)}
          onXpUpdate={setXpData}
        />
      )}

      {showKnowledge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.07] rounded-2xl shadow-2xl w-full max-w-md h-150 flex flex-col relative">
            <button
              onClick={() => setShowKnowledge(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 z-10"
            >
              <X size={16} />
            </button>
            <KnowledgePanel
              onQuickAction={({ prompt, isQuiz }) => {
                setShowKnowledge(false);
                if (isQuiz) {
                  setMode('QUIZ');
                  setQuizType('single');
                  setIsQuizActive(false);
                  setMessage(prompt);
                  setTimeout(() => handleSend(prompt), 100);
                } else {
                  setMode('LEARN');
                  setMessage(prompt);
                  setTimeout(() => handleSend(prompt), 100);
                }
              }}
            />
          </div>
        </div>
      )}

      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setShowSettings(false)}>
          <div
            className="relative flex w-170 h-140 rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07]"
            onClick={e => e.stopPropagation()}
          >
            {/* Left nav */}
            <div className="w-52 shrink-0 flex flex-col border-r h-full bg-zinc-50 dark:bg-[#0d0d0f] border-zinc-200 dark:border-white/[0.07]">
              <div className="p-5 border-b border-zinc-200 dark:border-white/[0.07]">
                <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition">
                  <X size={16} />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-0.5">
                {[
                  { id: 'general',    icon: Settings,      label: 'General'          },
                  { id: 'stats',      icon: BarChart2,     label: 'Stats & Progress' },
                  { id: 'account',    icon: Shield,        label: 'Account'          },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setSettingsTab(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      settingsTab === id
                        ? 'bg-violet-50 dark:bg-white/8 text-violet-700 dark:text-white font-semibold'
                        : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/4'
                    }`}
                  >
                    <Icon size={15} />{label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right content — fixed height, always scrollable, never resizes */}
            <div className="flex-1 h-full overflow-y-auto">

              {/* ── General ── */}
              {settingsTab === 'general' && (
                <div className="p-7 space-y-6">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">General</h2>
                  {/* Appearance */}
                  <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-white/6">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Appearance</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Choose light or dark interface</p>
                    </div>
                    <button
                      onClick={() => setIsDarkMode(p => !p)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-zinc-100 dark:bg-white/[0.07] text-zinc-500 dark:text-zinc-400"
                    >
                      {isDarkMode ? <><Moon size={13} /> Dark</> : <><Sun size={13} /> Light</>}
                    </button>
                  </div>
                  {/* Pomodoro */}
                  <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-white/6">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Pomodoro Timer</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">Focus timer with 25/5 min cycles</p>
                    </div>
                    <button
                      onClick={() => { setShowPomodoro(p => !p); setShowSettings(false); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showPomodoro ? 'bg-rose-600/80 text-white' : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-500 dark:text-zinc-400'}`}
                    >
                      {showPomodoro ? 'On' : 'Off'}
                    </button>
                  </div>
                  {/* Chat mode */}
                  <div className="py-4 border-b border-zinc-100 dark:border-white/6">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Default Chat Mode</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-3">Set your preferred learning mode</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['LEARN','QUIZ','SUMMARY','ANALYSIS','CODE'].map(m => (
                        <button
                          key={m}
                          onClick={() => { switchMode(m); }}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                            mode === m
                              ? 'bg-violet-600 text-white'
                              : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >{m}</button>
                      ))}
                    </div>
                  </div>
                  {/* Subject Focus */}
                  <div className="py-4">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Subject Focus</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-3">Personalises your AI plans and quizzes</p>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map(s => {
                        const selected = (profileData?.subject_focus || []).includes(s);
                        return (
                          <button
                            key={s}
                            onClick={async () => {
                              const current = profileData?.subject_focus || [];
                              const updated = selected ? current.filter(x => x !== s) : [...current, s];
                              const fd = new FormData();
                              fd.append('subject_focus', JSON.stringify(updated));
                              const r = await apiFetch(`${API_URL}/profile/${userId}`, { method: 'POST', body: fd });
                              const d = await r.json();
                              setProfileData(prev => ({ ...prev, subject_focus: updated }));
                              localStorage.setItem(`scholarly_profile_${userId}`, JSON.stringify({ ...profileData, subject_focus: updated }));
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                              selected
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.07] hover:border-violet-500/50'
                            }`}
                          >{s}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Stats & Progress ── */}
              {settingsTab === 'stats' && (
                <div className="p-7 space-y-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Stats & Progress</h2>
                  {/* Streak */}
                  <div className="rounded-2xl overflow-hidden">
                    <div className="p-5" style={{ background: 'linear-gradient(135deg, #f97316, #e11d48)' }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-orange-100 uppercase tracking-widest">Current Streak</p>
                          <div className="flex items-end gap-1.5 mt-1">
                            <span className="text-5xl font-black text-white tabular-nums leading-none">{streakData?.current || 0}</span>
                            <span className="text-sm font-bold text-orange-200 mb-1">days</span>
                          </div>
                          <p className="text-xs text-orange-200 mt-1">Personal best: {streakData?.longest || 0} days</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                          <Flame size={28} className="text-white" />
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-4">
                        {['M','T','W','T','F','S','S'].map((d, i) => (
                          <div key={i} className={`flex-1 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                            i < (streakData?.current || 0) % 7 ? 'bg-white text-orange-600' : 'text-orange-200'
                          }`} style={i >= (streakData?.current || 0) % 7 ? { background: 'rgba(255,255,255,0.15)' } : {}}>{d}</div>
                        ))}
                      </div>
                    </div>
                    <div className="px-5 py-3 rounded-b-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none' }}>
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const isAtRisk = streakData?.last_active && streakData.last_active !== today;
                        const freezeAvailable = !streakData?.freeze_used;

                        if (streakData?.recovered_today) {
                          return <span className="text-xs font-semibold text-blue-400">❄️ Streak saved by freeze!</span>;
                        }

                        if (isAtRisk && freezeAvailable) {
                          return (
                            <button
                              onClick={() => setShowFreezeConfirm(true)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-xs font-semibold text-amber-400">⚠️ Streak at risk — use freeze?</span>
                              <span className="text-xs text-blue-400 font-bold underline">Use Freeze</span>
                            </button>
                          );
                        }

                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-400">
                              {streakData?.freeze_used ? '❄️ Freeze used this week' : '❄️ Streak freeze ready'}
                            </span>
                            {freezeAvailable && (
                              <span className="text-xs text-blue-400 font-semibold">1 available</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {showFreezeConfirm && (
                      <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowFreezeConfirm(false)}>
                        <div className="bg-[#16161a] border border-blue-500/20 rounded-2xl p-6 w-75 text-center space-y-3" onClick={e => e.stopPropagation()}>
                          <span className="text-3xl">❄️</span>
                          <p className="text-sm font-bold text-white">Use your streak freeze?</p>
                          <p className="text-xs text-zinc-500">This protects your {streakData?.current || 0}-day streak. You only get one freeze per week.</p>
                          <div className="flex gap-2 pt-1">
                            <button
                              disabled={freezeLoading}
                              onClick={async () => {
                                setFreezeLoading(true);
                                try {
                                  const r = await apiFetch(`${API_URL}/streak/${userId}/use-freeze`, { method: 'POST' });
                                  if (r.ok) {
                                    const d = await r.json();
                                    setStreakData(d);
                                    localStorage.setItem(`scholarly_streak_${userId}`, JSON.stringify(d));
                                  }
                                } catch (e) {
                                  console.error('[freeze]', e);
                                } finally {
                                  setFreezeLoading(false);
                                  setShowFreezeConfirm(false);
                                }
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                            >
                              {freezeLoading ? 'Applying…' : 'Use Freeze'}
                            </button>
                            <button onClick={() => setShowFreezeConfirm(false)} disabled={freezeLoading}
                              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold transition-all">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* XP */}
                  <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #7c3aed, #4338ca)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-violet-200 uppercase tracking-widest">Level</p>
                        <span className="text-5xl font-black text-zinc-900 dark:text-white tabular-nums leading-none">{xpData?.level || 1}</span>
                      </div>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <Star size={26} className="text-amber-300" />
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <div className="h-full bg-linear-to-r from-amber-300 to-yellow-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.round(((xpData?.total || 0) % 500) / 500 * 100)}%` }} />
                    </div>
                    <div className="flex justify-between">
                      <p className="text-xs text-violet-200">{(xpData?.total || 0) % 500} / 500 XP</p>
                      <p className="text-xs text-violet-300 font-semibold">{500 - ((xpData?.total || 0) % 500)} XP to next level</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Account ── */}
              {settingsTab === 'account' && (
                <div className="p-7 space-y-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Account</h2>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-white/3 border border-zinc-200 dark:border-white/[0.07]">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-2xl shadow-lg">
                      {profileData?.avatar || '🎓'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{profileData?.name || 'Scholar'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{profileData?.email || ''}</p>
                    </div>
                    <button onClick={() => { setShowSettings(false); setShowProfile(true); }} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-100 dark:bg-white/[0.07]">Edit Profile</button>
                  </div>
                  {/* Change Password */}
                  <div className="py-4 border-b border-zinc-100 dark:border-white/6">
                    <p className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-widest font-bold mb-3">Change Password</p>
                    <div className="space-y-2">
                      <input
                        type="password" placeholder="Current password" value={pwCurrent}
                        onChange={e => setPwCurrent(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500/50"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShowForgotPassword(true)}
                          className="text-xs text-violet-400 hover:text-violet-300 transition-all"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password" placeholder="New password (min 8 chars)" value={pwNew}
                        onChange={e => setPwNew(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500/50"
                      />
                      {pwMsg && <p className={`text-xs font-semibold ${pwMsg.ok ? 'text-green-500' : 'text-red-400'}`}>{pwMsg.text}</p>}
                      <button
                        onClick={async () => {
                          setPwMsg(null);
                          const fd = new FormData();
                          fd.append('current_password', pwCurrent);
                          fd.append('new_password', pwNew);
                          try {
                            const r = await apiFetch(`${API_URL}/auth/change-password`, { method: 'POST', body: fd });
                            const d = await r.json();
                            if (!r.ok) { setPwMsg({ ok: false, text: d.detail || 'Failed.' }); return; }
                            setPwMsg({ ok: true, text: 'Password updated!' });
                            setPwCurrent(''); setPwNew('');
                          } catch { setPwMsg({ ok: false, text: 'Request failed.' }); }
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all"
                      >Update Password</button>
                    </div>
                  </div>

                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showWeakness && (
        <WeaknessPanel
          userId={userId}
          onClose={() => {
            setShowWeakness(false);
            // Refresh count so nudge disappears if user cleared weaknesses
            apiFetch(`${API_URL}/weaknesses/${userId}`)
              .then(r => r.json())
              .then(d => setWeaknessCount((d.weaknesses || []).length))
              .catch(() => {});
          }}
        />
      )}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.07] rounded-2xl shadow-xl p-8 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Reset Password</h3>
            <p className="text-xs text-zinc-500">Enter your email and we'll send a reset link.</p>
            <input
              type="email"
              placeholder="your@email.com"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500/50"
            />
            {forgotMsg && (
              <p className={`text-xs font-semibold ${forgotMsg.ok ? 'text-green-500' : 'text-red-400'}`}>{forgotMsg.text}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForgotPassword(false); setForgotMsg(null); setForgotEmail(''); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/8 transition-all"
              >Cancel</button>
              <button
                disabled={forgotLoading || !forgotEmail}
                onClick={async () => {
                  setForgotLoading(true); setForgotMsg(null);
                  const fd = new FormData();
                  fd.append('email', forgotEmail);
                  try {
                    const r = await apiFetch(`${API_URL}/auth/forgot-password`, { method: 'POST', body: fd });
                    const d = await r.json();
                    setForgotMsg({ ok: true, text: d.status });
                  } catch {
                    setForgotMsg({ ok: false, text: 'Request failed.' });
                  } finally {
                    setForgotLoading(false);
                  }
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50"
              >{forgotLoading ? 'Sending...' : 'Send Link'}</button>
            </div>
          </div>
        </div>
      )}
      {showOnboarding && (
        <OnboardingModal
          userId={userId}
          apiFetch={apiFetch}
          onComplete={(subjects, topic) => {
            setShowOnboarding(false);
            setProfileData(prev => ({ ...prev, subject_focus: subjects, onboarding_complete: true }));
            if (topic) setMessage(topic);
          }}
        />
      )}
    </div>
  );
}