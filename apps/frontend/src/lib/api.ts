import axios from "axios";
import Cookies from "js-cookie";

// All requests go to /api/* on the same origin.
// Next.js rewrites /api/:path* → BACKEND_URL/:path* (server-side only — IP:port never reaches the browser).
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove("token");
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
