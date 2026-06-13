/**
 * Plausible custom event tracker.
 * Safe to call — no-ops if Plausible isn't loaded.
 */
export function trackEvent(name, props = {}) {
  if (typeof window !== "undefined" && window.plausible) {
    window.plausible(name, { props });
  }
}

// Pre-defined events for consistency
export const Events = {
  SIGNUP:           "signup",
  LOGIN:            "login",
  QUIZ_STARTED:     "quiz_started",
  QUIZ_COMPLETED:   "quiz_completed",
  CHAT_MESSAGE:     "chat_message",
  PLAN_GENERATED:   "plan_generated",
  WEAKNESS_CLEARED: "weakness_cleared",
  ONBOARDING_DONE:  "onboarding_done",
};