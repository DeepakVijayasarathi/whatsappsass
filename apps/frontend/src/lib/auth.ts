import Cookies from "js-cookie";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  plan: string;
}

export function getToken(): string | undefined {
  return Cookies.get("token");
}

export function setAuth(token: string, user: AuthUser, workspace: AuthWorkspace) {
  // `secure` is set whenever the page is served over HTTPS so the token is never
  // sent over plaintext HTTP. It's omitted on http://localhost so local dev works.
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  Cookies.set("token", token, { expires: 7, sameSite: "strict", secure });
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("workspace", JSON.stringify(workspace));
  }
}

export function clearAuth() {
  Cookies.remove("token");
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
    localStorage.removeItem("workspace");
  }
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

export function getWorkspace(): AuthWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("workspace");
    return raw ? (JSON.parse(raw) as AuthWorkspace) : null;
  } catch {
    localStorage.removeItem("workspace");
    return null;
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    // A valid JWT must have exactly 3 dot-separated segments
    const parts = token.split(".");
    if (parts.length !== 3) {
      clearAuth();
      return false;
    }
    // Decode JWT payload (no signature verification — just check expiry client-side)
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuth(); // proactively clean up expired token
      return false;
    }
    return true;
  } catch {
    clearAuth(); // malformed token — clear it
    return false;
  }
}
