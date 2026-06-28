import { useState } from 'react';
import { API_URL, apiFetch } from '@/lib/api';

export function useQuiz({ userId, currentSessionId, sessions, setSessions, awardXp, refreshNotifications, lastFeedbackWrong, setLastFeedbackWrong }) {
  const [quizType,                setQuizType]                = useState(null);
  const [isQuizTypeDropdownOpen,  setIsQuizTypeDropdownOpen]  = useState(false);
  const [isQuizActive,            setIsQuizActive]            = useState(false);
  const [currentQuizQuestion,     setCurrentQuizQuestion]     = useState(null);
  const [questionNumber,          setQuestionNumber]          = useState(1);
  const [isQuestionAnswered,      setIsQuestionAnswered]      = useState(false);
  const [paperAnswers,            setPaperAnswers]            = useState(null);
  const [isLoadingAnswers,        setIsLoadingAnswers]        = useState({});
  const [isLoading,               setIsLoading]               = useState(false);

  const selectQuizType = (type) => {
    setQuizType(type);
    setIsQuizTypeDropdownOpen(false);
  };

  const handleOptionSelected = async (selectedLetter) => {
    setIsQuestionAnswered(true);
    const userMsg = { role: 'user', content: `My answer: ${selectedLetter})`, id: Date.now() };
    setSessions(prev => ({ ...prev, [currentSessionId]: [...(prev[currentSessionId] || []), userMsg] }));
    await submitQuizAnswer(selectedLetter);
  };

  const submitQuizAnswer = async (answer) => {
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('message',         answer);
      fd.append('session_id',      `${userId}_${currentSessionId}`);
      fd.append('mode',            'QUIZ');
      fd.append('quiz_type',       quizType);
      fd.append('question_number', questionNumber + 1);
      fd.append('is_starting',     'false');
      fd.append('user_id',         userId);
      fd.append('last_was_wrong',  lastFeedbackWrong ? 'true' : 'false');
      if (currentQuizQuestion) fd.append('last_question', currentQuizQuestion);

      const res = await apiFetch(`${API_URL}/quiz`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Quiz error ${res.status}`);
      const data = await res.json();

      const wasWrong = data.is_correct === false;
      setLastFeedbackWrong(wasWrong);

      if (data.feedback) {
        setSessions(prev => ({ ...prev, [currentSessionId]: [...(prev[currentSessionId] || []),
          { role: 'assistant', content: `**Feedback:** ${data.feedback}`, id: Date.now() + 1, isFeedback: true }
        ]}));
      }
      setSessions(prev => ({ ...prev, [currentSessionId]: [...(prev[currentSessionId] || []),
        { role: 'assistant', content: data.new_question, id: Date.now() + 2, isQuestion: true }
      ]}));

      setCurrentQuizQuestion(data.new_question);
      setQuestionNumber(data.question_number);
      setIsQuestionAnswered(false);
      await awardXp(wasWrong ? 'message_sent' : 'quiz_correct');
      refreshNotifications();
    } catch (err) {
      console.error('Quiz error:', err);
      setSessions(prev => ({ ...prev, [currentSessionId]: [...(prev[currentSessionId] || []),
        { role: 'assistant', content: '⚠️ Error loading next question. Please try again.', id: 'error' }
      ]}));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowAnswers = async (msgId, paperContent) => {
    setIsLoadingAnswers(prev => ({ ...prev, [msgId]: true }));
    try {
      const fd = new FormData();
      fd.append('session_id', `${userId}_${currentSessionId}`);
      if (paperContent) fd.append('paper_content', paperContent);
      const res = await apiFetch(`${API_URL}/quiz/answers`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Answers error ${res.status}`);
      const data = await res.json();
      setPaperAnswers(prev => ({ ...(prev || {}), [msgId]: data.answers }));
    } catch (err) {
      console.error('Error fetching answers:', err);
    } finally {
      setIsLoadingAnswers(prev => ({ ...prev, [msgId]: false }));
    }
  };

  const exitQuiz = async () => {
    try {
      const fd = new FormData();
      fd.append('session_id', `${userId}_${currentSessionId}`);
      await apiFetch(`${API_URL}/quiz/reset`, { method: 'POST', body: fd });
    } catch (err) {
      console.error('Error resetting quiz:', err);
    }
    setIsQuizActive(false);
    setQuizType(null);
    setIsQuizTypeDropdownOpen(false);
    setQuestionNumber(1);
    setCurrentQuizQuestion(null);
    setIsQuestionAnswered(false);
    setPaperAnswers(null);
  };

  return {
    quizType, setQuizType,
    isQuizTypeDropdownOpen, setIsQuizTypeDropdownOpen,
    isQuizActive, setIsQuizActive,
    currentQuizQuestion, setCurrentQuizQuestion,
    questionNumber, setQuestionNumber,
    isQuestionAnswered, setIsQuestionAnswered,
    paperAnswers, setPaperAnswers,
    isLoadingAnswers, setIsLoadingAnswers,
    isLoading, setIsLoading,
    selectQuizType,
    handleOptionSelected,
    submitQuizAnswer,
    handleShowAnswers,
    exitQuiz,
  };
}