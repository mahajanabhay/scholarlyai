const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export { API_URL };

export function getAuthHeaders() {
  return {};
}

/**
 * Drop-in fetch wrapper that catches 401 responses and redirects to /login.
 * Import and use `apiFetch` instead of `fetch` anywhere auth is required.
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    window.location.replace("/login");
    // Return a never-resolving promise so callers don't process a 401 body
    return new Promise(() => {});
  }

  return res;
}

export async function signupUser({ name, email, password }) {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("email", email);
  fd.append("password", password);
  const res = await fetch(`${API_URL}/auth/register`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Signup failed");
  }
  const data = await res.json();
  localStorage.setItem("scholarly_user_id", data.user_id);
  localStorage.setItem("scholarly_email",   data.email);
  localStorage.setItem("scholarly_name",    data.name);
  return data;
}

export async function loginUser({ email, password }) {
  const fd = new FormData();
  fd.append("email", email);
  fd.append("password", password);
  const res = await fetch(`${API_URL}/auth/login`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  const data = await res.json();
  localStorage.setItem("scholarly_user_id", data.user_id);
  localStorage.setItem("scholarly_email",   data.email);
  localStorage.setItem("scholarly_name",    data.name);
  return data;
}