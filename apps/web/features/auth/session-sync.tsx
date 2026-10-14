"use client";

import { useEffect } from "react";

import { SESSION_KEY, sessionStorage } from "@/app/api/session-storage";

export function SessionSync() {
  useEffect(() => {
    const currentSession = sessionStorage.get();
    const currentUserId = currentSession?.user.publicId ?? null;
    sessionStorage.syncRoutingHints();
    // Middleware cannot read localStorage. Restore its hints if the browser
    // retained the session but expired or removed the routing cookies.
    if (currentSession && ["/login", "/register"].includes(window.location.pathname)) {
      window.location.replace(currentSession.user.role === "admin" ? "/dashboard" : "/social");
    }
    const checkSession = () => {
      sessionStorage.syncRoutingHints();
      const nextUserId = sessionStorage.get()?.user.publicId ?? null;
      if (nextUserId !== currentUserId) {
        window.location.replace(nextUserId ? (sessionStorage.get()?.user.role === 'admin' ? '/dashboard' : '/social') : '/login');
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === null) checkSession();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", checkSession);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", checkSession);
    };
  }, []);

  return null;
}
