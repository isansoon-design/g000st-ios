"use client";

import { useEffect, useState } from "react";

export function useChatPrivacy(): boolean {
  const [isObscured, setIsObscured] = useState(false);

  useEffect(() => {
    // Window focus can change while the page remains visible (browser controls,
    // permission dialogs). Only hide the conversation when the page is hidden.
    const syncPrivacy = () => {
      setIsObscured(document.visibilityState === "hidden");
    };
    syncPrivacy();
    document.addEventListener("visibilitychange", syncPrivacy);
    window.addEventListener("pageshow", syncPrivacy);
    return () => {
      document.removeEventListener("visibilitychange", syncPrivacy);
      window.removeEventListener("pageshow", syncPrivacy);
    };
  }, []);

  return isObscured;
}
