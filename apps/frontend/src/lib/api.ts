import axios, { AxiosError } from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { clearAuth } from "./auth";

/** Safely extract a human-readable string from an API error response.
 *  Handles three shapes:
 *  1. Plain string:  { error: "Something went wrong" }
 *  2. Zod flatten:  { error: { fieldErrors: { phone: ["Invalid"] }, formErrors: [] } }
 *  3. Zod form-level: { error: { formErrors: ["Must have at least one step"] } }
 */
export function getErrMsg(err: unknown, fallback: string): string {
  const errData = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;

  // Shape 1 — plain string
  if (typeof errData === "string" && errData.length > 0) return errData;

  // Shape 2 & 3 — Zod flatten object
  if (errData !== null && typeof errData === "object") {
    const { fieldErrors, formErrors } = errData as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
    // Pick the first field error message (most specific)
    if (fieldErrors) {
      const first = Object.values(fieldErrors).flat().find((m): m is string => !!m);
      if (first) return first;
    }
    // Fall back to form-level errors
    if (formErrors?.[0]) return formErrors[0];
  }

  return fallback;
}

// All requests go to /api/* on the same origin.
// Next.js rewrites /api/:path* → BACKEND_URL/:path* (server-side only — IP:port never reaches the browser).
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  // Abort requests that hang for more than 30 s
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status;

    if (status === 401) {
      // Clear ALL auth state before redirecting
      clearAuth();
      if (typeof window !== "undefined") {
        // Guard against redirect loop: don't redirect if already on an auth page
        const path = window.location.pathname;
        if (!path.startsWith("/login") && !path.startsWith("/register") && !path.startsWith("/forgot-password")) {
          window.location.href = "/login";
        }
      }
      return Promise.reject(err);
    }

    if (status === 502 || status === 503 || status === 504) {
      toast.error("Service temporarily unavailable. Please try again.", { id: "svc-unavailable" });
    } else if (status && status >= 500 && status < 600) {
      toast.error("A server error occurred. Our team has been notified.", { id: "server-error" });
    }

    // Network error (no response) — backend unreachable
    if (!err.response && err.code !== "ERR_CANCELED") {
      toast.error("Network error — check your connection.", { id: "network-error" });
    }

    return Promise.reject(err);
  }
);
