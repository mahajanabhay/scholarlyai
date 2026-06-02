"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "../components/chat/Dashboard.jsx";
import ErrorBoundary from "../components/common/ErrorBoundary";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const uid   = localStorage.getItem("scholarly_user_id");
    const token = localStorage.getItem("scholarly_token");

    // Redirect immediately if either credential is missing
    if (!uid || !token) {
      router.push("/landing");
      return;
    }

    // Verify token is still valid server-side — catches expired tokens
    // and prevents a broken dashboard experience on 401 errors
    fetch(`${API_URL}/auth/check/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          // Token expired or invalid — clear stale credentials and redirect
          localStorage.removeItem("scholarly_user_id");
          localStorage.removeItem("scholarly_token");
          localStorage.removeItem("scholarly_email");
          localStorage.removeItem("scholarly_name");
          router.push("/login");
        }
      })
      .catch(() => {
        // Network error — allow through so offline users aren't locked out
        setIsAuthenticated(true);
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}><p>Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}