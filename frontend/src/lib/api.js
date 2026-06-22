const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export { API_URL };

export function getAuthHeaders() {
  return {};
}

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { ...(options.headers || {}) },
  });

  if (res.status === 401) {
    window.location.replace("/login");
    return new Promise(() => {});
  }

  return res;
}

export async function signupUser({ name, email, password }) {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("email", email);
  fd.append("password", password);
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST", body: fd, credentials: "include",
  });
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
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST", body: fd, credentials: "include",
  });
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