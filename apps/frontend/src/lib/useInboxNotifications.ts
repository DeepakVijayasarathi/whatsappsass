"use client";

import { useEffect, useRef } from "react";
import { api } from "./api";

export function useInboxNotifications(
  onCountChange: (count: number) => void,
  intervalMs = 30_000
) {
  const prevCountRef = useRef<number | null>(null);

  const requestPermission = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  };

  const check = async () => {
    try {
      const res = await api.get("/whatsapp/inbox?limit=1");
      const count: number = res.data.totalUnread ?? 0;
      onCountChange(count);

      const prev = prevCountRef.current;
      if (prev !== null && count > prev) {
        const newCount = count - prev;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("New WhatsApp message", {
            body: `You have ${newCount} new message${newCount > 1 ? "s" : ""} in your inbox`,
            icon: "/favicon.ico",
            tag: "inbox-notification",
          });
        }
      }

      prevCountRef.current = count;
    } catch {
      // silently ignore — e.g., unauthenticated
    }
  };

  useEffect(() => {
    requestPermission();
    check();
    const timer = setInterval(check, intervalMs);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
