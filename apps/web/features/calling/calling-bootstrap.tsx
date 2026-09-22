"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks";
import { callManager } from "@/features/calling/call-manager";

export function CallingBootstrap() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    callManager.start();
    return () => callManager.stop();
  }, [isAuthenticated]);

  return null;
}
