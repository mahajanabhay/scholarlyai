"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "../components/chat/Dashboard.jsx";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { getAuthHeaders } from "../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem("scholarly_user_id");

    if (!uid) {
      router.push("/landing");
      return;
    }

    fetch(
      `${API_URL}/auth/check/${uid}`,
      {
        headers: getAuthHeaders(),
        credentials: "include",
      }
    )
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("scholarly_user_id");
          localStorage.removeItem("scholarly_email");
          localStorage.removeItem("scholarly_name");
          router.push("/login");
        }
      })
      .catch(() => {
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