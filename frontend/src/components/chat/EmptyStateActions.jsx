"use client";

import {
  Clock,
  ChevronRight,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { User, Calendar } from "lucide-react";
export default function EmptyStateActions({
  onContinueSession,
  onStartQuiz,
  onReviseWeaknesses,
  hasLastSession,
  lastSessionDate,
  onOpenProfile,
  onOpenPlanner,
  onOpenPomodoro,
}) {
  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      {/* Continue Last Session Button */}
      {hasLastSession && (
        <button
          onClick={onContinueSession}
          className="group flex items-center justify-between w-full px-6 py-4 rounded-2xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all hover:border-blue-400 dark:hover:border-blue-700"
        >
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Continue Last Session</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">{lastSessionDate || "Resume where you left off"}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* Start Quiz Button */}
      <button
        onClick={onStartQuiz}
        className="group flex items-center justify-between w-full px-6 py-4 rounded-2xl border-2 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all hover:border-purple-400 dark:hover:border-purple-700"
      >
        <div className="flex items-center gap-3">
          <Flame size={20} className="text-purple-600 dark:text-purple-400" />
          <div className="text-left">
            <p className="font-semibold text-sm text-purple-900 dark:text-purple-100">Start Quiz</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">Test your knowledge on any topic</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Revise Weaknesses Button */}
      <button
        onClick={onReviseWeaknesses}
        className="group flex items-center justify-between w-full px-6 py-4 rounded-2xl border-2 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all hover:border-amber-400 dark:hover:border-amber-700"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          <div className="text-left">
            <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">Revise Weaknesses</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Focus on areas to improve</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Open Profile Button */}
      <button
        onClick={onOpenProfile}
        className="group flex items-center justify-between w-full px-6 py-4 rounded-2xl border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 transition-all hover:border-green-400 dark:hover:border-green-700"
      >
        <div className="flex items-center gap-3">
          <User size={20} className="text-green-600 dark:text-green-400" />
          <div className="text-left">
            <p className="font-semibold text-sm text-green-900 dark:text-green-100">Open Profile</p>
            <p className="text-xs text-green-600 dark:text-green-400">View your progress and stats</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Open Planner Button */}
      <button
        onClick={onOpenPlanner}
        className="group flex items-center justify-between w-full px-6 py-4 rounded-2xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all hover:border-blue-400 dark:hover:border-blue-700"
      >
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
          <div className="text-left">
            <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Open Planner</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Manage your study schedule</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Open Pomodoro Timer Button */}
      <button
        onClick={onOpenPomodoro}
        className="group flex items-center justify-between w-full px-6 py-4 rounded-2xl border-2 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900 transition-all hover:border-orange-400 dark:hover:border-orange-700"
      >
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-orange-600 dark:text-orange-400" />
          <div className="text-left">
            <p className="font-semibold text-sm text-orange-900 dark:text-orange-100">Open Pomodoro Timer</p>
            <p className="text-xs text-orange-600 dark:text-orange-400">Stay focused with the Pomodoro technique</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-orange-600 dark:text-orange-400 group-hover:translate-x-1 transition-transform" />
      </button>

    </div>
  );
}