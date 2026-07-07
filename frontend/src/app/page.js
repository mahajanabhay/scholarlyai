"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "../components/chat/Dashboard.jsx";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/landing");
    }
  }, [isLoading, isAuthenticated, router]);

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